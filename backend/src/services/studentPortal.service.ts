import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, getPublicClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { PdfReportService } from './pdfReport.service.js';
import { receiptService } from './receipt.service.js';

export interface StudentAuthProfile {
  studentId: string;
  authUserId: string;
  name: string;
  phone: string;
  email: string;
  portalStatus: 'NOT_INVITED' | 'INVITED' | 'ACTIVE';
  lastLoginAt?: string;
  inviteSentAt?: string;
  reminderCount: number;
}

export class StudentPortalService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  /**
   * Helper to format internal student auth email from clean phone
   */
  private getStudentAuthEmail(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const digits = cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
    return `student_${digits}@gurukulsports.internal`;
  }

  /**
   * Ensure student has a registered Supabase Auth account and Profile
   */
  async ensureStudentUser(studentId: string, initialPassword?: string): Promise<{
    authUserId: string;
    email: string;
    phone: string;
    password: string;
    isNew: boolean;
  }> {
    const { data: student, error: studentErr } = await this.supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      throw new AppError('Student record not found.', 404, 'NOT_FOUND');
    }

    const rawPhone = student.student_mobile || student.parent_whatsapp || student.phone || '';
    const phone = normalizePhoneNumber(rawPhone) || rawPhone;
    const digits = phone.replace(/\D/g, '').slice(-10);

    if (!digits || digits.length < 10) {
      throw new AppError('Student has no valid 10-digit mobile number for portal access.', 400, 'INVALID_PHONE');
    }

    const authEmail = this.getStudentAuthEmail(digits);
    const password = initialPassword || `Gurukul@${digits.slice(-4)}`;

    // Check if auth user already exists
    const { data: listData } = await this.supabase.auth.admin.listUsers();
    let authUser = listData?.users?.find((u) => u.email === authEmail);
    let isNew = false;

    if (!authUser) {
      const { data: created, error: createErr } = await this.supabase.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: ROLES.STUDENT,
          student_id: student.id,
          student_name: student.name,
          phone: digits,
          initial_pin: password,
          portal_status: 'INVITED',
          invite_sent_at: new Date().toISOString(),
          reminder_count: 0,
        },
      });

      if (createErr || !created.user) {
        throw new AppError(`Failed to create student auth account: ${createErr?.message}`, 500);
      }
      authUser = created.user;
      isNew = true;
    } else if (initialPassword) {
      // Update password if specifically requested
      await this.supabase.auth.admin.updateUserById(authUser.id, {
        password,
        user_metadata: {
          ...authUser.user_metadata,
          student_id: student.id,
          student_name: student.name,
          phone: digits,
          initial_pin: password,
        },
      });
    }

    // Ensure Profile exists with role STUDENT
    await this.supabase.from('profiles').upsert({
      id: authUser.id,
      role: ROLES.STUDENT,
      full_name: student.name,
      phone: digits,
      email: authEmail,
      status: STATUS.ACTIVE,
      updated_at: new Date().toISOString(),
    });

    return {
      authUserId: authUser.id,
      email: authEmail,
      phone: digits,
      password,
      isNew,
    };
  }

  /**
   * Student Login using Phone number (or Email) and Password
   */
  async studentLogin(identifier: string, passwordInput: string) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new AppError('Authentication service unavailable.', 500);
    }

    const trimmed = identifier.trim();
    let authEmail = trimmed;

    // If identifier is a phone number (contains digits and no @)
    if (!trimmed.includes('@')) {
      const digits = trimmed.replace(/\D/g, '').slice(-10);
      if (digits.length < 10) {
        throw new AppError('Please enter a valid 10-digit registered mobile number.', 400);
      }

      authEmail = this.getStudentAuthEmail(digits);

      // Verify student exists in students table
      const { data: matchingStudents } = await this.supabase
        .from('students')
        .select('*')
        .or(`student_mobile.ilike.%${digits}%,parent_whatsapp.ilike.%${digits}%`)
        .limit(1);

      if (!matchingStudents || matchingStudents.length === 0) {
        throw new AppError('No student record found with this registered mobile number.', 404, 'STUDENT_NOT_FOUND');
      }

      const student = matchingStudents[0];

      // Check if auth user exists, if not auto-provision if matching default password
      const { data: userList } = await this.supabase.auth.admin.listUsers();
      let user = userList?.users?.find((u) => u.email === authEmail);

      if (!user) {
        // Auto-provision student user
        const provisioned = await this.ensureStudentUser(student.id, passwordInput);
        authEmail = provisioned.email;
      }
    }

    // Authenticate with Supabase Auth
    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: authEmail,
      password: passwordInput,
    });

    if (authErr || !authData.session || !authData.user) {
      throw new AppError('Incorrect mobile number or password. Please try again.', 401, 'INVALID_CREDENTIALS');
    }

    const authUserId = authData.user.id;

    // Retrieve profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (!profile || profile.status !== STATUS.ACTIVE) {
      throw new AppError('Student account is inactive. Please contact your academy administrator.', 403);
    }

    // Resolve student record
    let studentId = authData.user.user_metadata?.student_id;
    let studentRecord: any = null;

    if (studentId) {
      const { data: s } = await this.supabase.from('students').select('*').eq('id', studentId).maybeSingle();
      studentRecord = s;
    }

    if (!studentRecord) {
      const digits = (profile.phone || '').replace(/\D/g, '').slice(-10);
      const { data: fallbackList } = await this.supabase
        .from('students')
        .select('*')
        .or(`student_mobile.ilike.%${digits}%,parent_whatsapp.ilike.%${digits}%`)
        .limit(1);
      studentRecord = fallbackList?.[0] || null;
      if (studentRecord) {
        studentId = studentRecord.id;
      }
    }

    // Mark student as active in user_metadata and record login timestamp
    const nowIso = new Date().toISOString();
    await this.supabase.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        ...authData.user.user_metadata,
        portal_status: 'ACTIVE',
        last_login_at: nowIso,
      },
    });

    return {
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authUserId,
        email: profile.email,
        fullName: profile.full_name,
        role: ROLES.STUDENT,
        studentId,
        phone: profile.phone,
      },
      student: studentRecord,
    };
  }

  /**
   * Get Student Profile with Batch, Sensei, Course, and Ranks
   */
  async getStudentProfile(studentId: string) {
    const { data: student, error } = await this.supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (error || !student) {
      throw new AppError('Student profile not found.', 404);
    }

    // Resolve assigned batches
    const { data: batchLinks } = await this.supabase
      .from('batch_students')
      .select('batch_id, batches(*)')
      .eq('student_id', studentId);

    const batches = (batchLinks || [])
      .map((bl: any) => bl.batches)
      .filter(Boolean);

    // Resolve active rank
    const { data: ranks } = await this.supabase
      .from('student_ranks')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    // Academy Settings for branding & contacts
    const { data: settings } = await this.supabase
      .from('academy_settings')
      .select('academy_name, phone, email, address, logo_url')
      .limit(1)
      .maybeSingle();

    return {
      student,
      batches,
      ranks: ranks || [],
      currentRank: ranks?.[0] || null,
      academy: settings || {
        academy_name: 'Gurukul Sports Academy',
        phone: '+91 98765 43210',
        email: 'admin@gurukulsports.in',
      },
    };
  }

  /**
   * Get Student Attendance with Current Month + Previous Month History & Streak
   */
  async getStudentAttendance(studentId: string, yearInput?: number, monthInput?: number) {
    const now = new Date();
    const selectedYear = yearInput || now.getFullYear();
    const selectedMonth = monthInput !== undefined ? monthInput : now.getMonth() + 1; // 1-indexed

    // Format start and end of selected month (e.g. 2026-10-01 to 2026-10-31)
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Previous month calculation
    const prevDateObj = new Date(selectedYear, selectedMonth - 2, 1);
    const prevYear = prevDateObj.getFullYear();
    const prevMonth = prevDateObj.getMonth() + 1;
    const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

    // Query selected month attendance
    const { data: currentRecords, error: curErr } = await this.supabase
      .from('attendance')
      .select('id, date, status, batches(name, start_time, end_time)')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (curErr) {
      console.error('[StudentPortal.getStudentAttendance] Error:', curErr.message);
    }

    const records = currentRecords || [];
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const totalSessions = records.length;
    const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    // Query previous month attendance
    const { data: prevRecords } = await this.supabase
      .from('attendance')
      .select('id, status')
      .eq('student_id', studentId)
      .gte('date', prevStartDate)
      .lte('date', prevEndDate);

    const prevList = prevRecords || [];
    const prevPresent = prevList.filter((r) => r.status === 'PRESENT').length;
    const prevTotal = prevList.length;
    const prevPercentage = prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 100) : 0;

    // Calculate current streak
    let currentStreak = 0;
    const sortedDesc = [...records].sort((a, b) => (b.date > a.date ? 1 : -1));
    for (const r of sortedDesc) {
      if (r.status === 'PRESENT') {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      selectedYear,
      selectedMonth,
      monthName: new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' }),
      totalSessions,
      presentCount,
      absentCount,
      attendancePercentage,
      currentStreak,
      records,
      previousMonth: {
        year: prevYear,
        month: prevMonth,
        monthName: prevDateObj.toLocaleString('default', { month: 'long' }),
        totalSessions: prevTotal,
        presentCount: prevPresent,
        absentCount: prevTotal - prevPresent,
        attendancePercentage: prevPercentage,
      },
    };
  }

  /**
   * Get Student Fees, Dues & Receipts History
   */
  async getStudentFees(studentId: string) {
    const { data: student } = await this.supabase
      .from('students')
      .select('id, name, monthly_fee, fee_due_day, status')
      .eq('id', studentId)
      .single();

    // Student fee plans / current dues
    const { data: feeRecords } = await this.supabase
      .from('student_fees')
      .select('*')
      .eq('student_id', studentId)
      .order('due_date', { ascending: false });

    // Recent payments
    const { data: payments } = await this.supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    // Official Receipts
    const { data: receipts } = await this.supabase
      .from('receipts')
      .select('*')
      .eq('student_id', studentId)
      .order('receipt_date', { ascending: false });

    const pendingFees = (feeRecords || []).filter((f) => f.status === 'PENDING' || f.status === 'OVERDUE');
    const totalPendingAmount = pendingFees.reduce((sum, f) => sum + Math.max(0, Number(f.amount_due || 0) - Number(f.amount_paid || 0)), 0);

    return {
      monthlyFee: student?.monthly_fee || 0,
      feeDueDay: student?.fee_due_day || 5,
      totalPendingAmount,
      pendingCount: pendingFees.length,
      feeRecords: feeRecords || [],
      payments: payments || [],
      receipts: receipts || [],
    };
  }

  /**
   * Update Student Password
   */
  async changePassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters.', 400);
    }

    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new AppError(`Failed to update password: ${error.message}`, 500);
    }

    return { success: true, message: 'Password updated successfully!' };
  }

  /**
   * List Onboarding Status of all students for Admin Table
   */
  async listStudentsOnboardingStatus() {
    const { data: students } = await this.supabase
      .from('students')
      .select('id, name, student_mobile, parent_whatsapp, email, status, created_at')
      .order('name', { ascending: true });

    const { data: usersData } = await this.supabase.auth.admin.listUsers();
    const authMap = new Map<string, any>();

    (usersData?.users || []).forEach((u) => {
      const studentId = u.user_metadata?.student_id;
      if (studentId) {
        authMap.set(studentId, u);
      }
      const phone = u.user_metadata?.phone;
      if (phone) {
        authMap.set(phone, u);
      }
    });

    return (students || []).map((s) => {
      const phoneDigits = (s.student_mobile || s.parent_whatsapp || '').replace(/\D/g, '').slice(-10);
      const authUser = authMap.get(s.id) || authMap.get(phoneDigits);
      const meta = authUser?.user_metadata || {};

      const portalStatus = meta.last_login_at
        ? 'ACTIVE'
        : meta.invite_sent_at
        ? 'INVITED'
        : 'NOT_INVITED';

      return {
        studentId: s.id,
        name: s.name,
        phone: s.student_mobile || s.parent_whatsapp || '',
        portalStatus,
        lastLoginAt: meta.last_login_at || null,
        inviteSentAt: meta.invite_sent_at || null,
        reminderCount: meta.reminder_count || 0,
        hasAuthAccount: Boolean(authUser),
      };
    });
  }

  /**
   * Get Announcements relevant to this Student
   */
  async getStudentAnnouncements(studentId: string) {
    // 1. Resolve student's batches
    const { data: batchLinks } = await this.supabase
      .from('batch_students')
      .select('batch_id')
      .eq('student_id', studentId);

    const studentBatchIds = (batchLinks || []).map((b) => b.batch_id);

    // 2. Fetch announcements
    const { data: announcements, error } = await this.supabase
      .from('announcements')
      .select(`
        id,
        title,
        message,
        priority,
        scope,
        metadata,
        created_at,
        updated_at,
        batches:announcement_batches(
          batch:batches(id, name, subject)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(`Failed to fetch announcements: ${error.message}`, 500);
    }

    // 3. Filter announcements applicable to student (scope ALL, no batch links, or targeting student's batch)
    const filtered = (announcements || []).filter((a: any) => {
      if (a.scope === 'ALL') return true;
      const targetedBatchIds = (a.batches || []).map((b: any) => b.batch?.id).filter(Boolean);
      if (targetedBatchIds.length === 0) return true;
      return targetedBatchIds.some((bId: string) => studentBatchIds.includes(bId));
    });

    return filtered;
  }

  /**
   * Get Official PDF Receipt Buffer for download
   */
  async getReceiptPdfBuffer(receiptId: string, studentId: string): Promise<{ buffer: Buffer; fileName: string; receiptNumber: string }> {
    const { receipt, academy } = await receiptService.getReceiptById(receiptId);

    // Ensure receipt belongs to this student
    const student = (receipt as any).student;
    if (student && student.id !== studentId) {
      throw new AppError('Unauthorized access to this receipt record.', 403, 'FORBIDDEN');
    }

    const payment = (receipt as any).payment || {};
    const academyName = academy?.name || 'Gurukul Sports Academy';

    const pdfBuffer = await PdfReportService.generateReceiptPdf({
      receiptNumber: receipt.receipt_number,
      studentName: student?.name || 'Student',
      course: student?.course,
      amount: Number(receipt.amount),
      issuedAt: receipt.issued_at || (receipt as any).created_at,
      paymentMode: payment.provider || 'CASH/UPI',
      transactionRef: payment.provider_payment_id || payment.id,
      academyName,
      academyAddress: academy?.address,
      academyPhone: academy?.contact_phone,
      academyEmail: academy?.contact_email,
    });

    const safeStudentName = (student?.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Receipt_${receipt.receipt_number || receipt.id.slice(0, 8)}_${safeStudentName}.pdf`;

    return {
      buffer: pdfBuffer,
      fileName,
      receiptNumber: receipt.receipt_number,
    };
  }
}

export const studentPortalService = new StudentPortalService();
