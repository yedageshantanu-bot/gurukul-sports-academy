import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { CreateStudentDTO, UpdateStudentDTO } from '../types/crm.types.js';
import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phone.js';
import { automationService } from './whatsapp/automation.service.js';

export class StudentService {
  /**
   * List students with filtering and role-based scope
   * Admin: can see all students
   * Teacher: can ONLY see students enrolled in batches assigned to them
   */
  static async listStudents(
    query: { search?: string; status?: string; batchId?: string },
    requestingUser: AuthenticatedUser
  ) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    let allowedStudentIds: string[] | null = null;

    // Server-side Teacher scoping: restrict to students in assigned batches
    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        return [];
      }

      // 1. Get batches assigned to this teacher
      const { data: teacherBatches, error: tbError } = await supabaseAdmin
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', requestingUser.teacherId);

      if (tbError || !teacherBatches || teacherBatches.length === 0) {
        return [];
      }

      const batchIds = teacherBatches.map((tb) => tb.batch_id);

      // If a specific batchId was requested in query, ensure it is one of teacher's batches
      if (query.batchId && !batchIds.includes(query.batchId)) {
        throw new AppError('You are not authorized to view students for this batch.', 403, 'FORBIDDEN');
      }

      const targetBatchIds = query.batchId ? [query.batchId] : batchIds;

      // 2. Get students enrolled in these batches
      const { data: enrolledStudents, error: esError } = await supabaseAdmin
        .from('batch_students')
        .select('student_id')
        .in('batch_id', targetBatchIds)
        .eq('status', STATUS.ACTIVE);

      if (esError || !enrolledStudents || enrolledStudents.length === 0) {
        return [];
      }

      allowedStudentIds = Array.from(new Set(enrolledStudents.map((es) => es.student_id)));
    } else if (query.batchId) {
      // Admin filtered by batchId
      const { data: enrolledStudents } = await supabaseAdmin
        .from('batch_students')
        .select('student_id')
        .eq('batch_id', query.batchId)
        .eq('status', STATUS.ACTIVE);

      allowedStudentIds = enrolledStudents ? enrolledStudents.map((es) => es.student_id) : [];
    }

    let dbQuery = supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        parent_name,
        student_mobile,
        parent_whatsapp,
        email,
        course,
        admission_date,
        monthly_fee,
        fee_due_day,
        status,
        whatsapp_opt_in,
        created_at,
        updated_at,
        batch_students (
          batch_id,
          status,
          batches (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (query.status && (query.status === STATUS.ACTIVE || query.status === STATUS.INACTIVE)) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    if (allowedStudentIds !== null) {
      if (allowedStudentIds.length === 0) {
        return [];
      }
      dbQuery = dbQuery.in('id', allowedStudentIds);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new AppError(`Failed to fetch students: ${error.message}`, 500);
    }

    // Current month identifier in YYYY-MM
    const now = new Date();
    const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If Admin, query current month's fee status for all fetched students
    const studentFeeMap = new Map<string, { status: string; pendingAmount: number }>();
    if (requestingUser.role === ROLES.ADMIN && data && data.length > 0) {
      const studentIds = data.map((s: any) => s.id);
      const { data: fees } = await supabaseAdmin
        .from('student_fees')
        .select('student_id, amount_due, amount_paid, due_date, status')
        .in('student_id', studentIds)
        .eq('billing_period', currentBillingPeriod);

      (fees || []).forEach((f: any) => {
        const amountDue = Number(f.amount_due || 0);
        const amountPaid = Number(f.amount_paid || 0);
        const pendingAmount = Math.max(0, amountDue - amountPaid);
        let currentStatus = f.status || 'PENDING';
        if (pendingAmount <= 0) {
          currentStatus = 'PAID';
        } else if (amountPaid > 0) {
          currentStatus = 'PARTIAL';
        } else if (new Date(f.due_date) < today) {
          currentStatus = 'OVERDUE';
        } else {
          currentStatus = 'PENDING';
        }

        studentFeeMap.set(f.student_id, {
          status: currentStatus,
          pendingAmount,
        });
      });
    }

    let students = (data || []).map((s: any) => {
      const activeBatchLinks = (s.batch_students || []).filter(
        (bs: any) => bs.status === STATUS.ACTIVE || !bs.status
      );
      const enrolledBatches = activeBatchLinks
        .map((bs: any) => bs.batches)
        .filter(Boolean);

      const feeInfo = studentFeeMap.get(s.id);

      return {
        id: s.id,
        name: s.name,
        parentName: s.parent_name || '',
        studentMobile: s.student_mobile || '',
        parentWhatsapp: s.parent_whatsapp || '',
        email: s.email || '',
        course: s.course || '',
        admissionDate: s.admission_date,
        monthlyFee: Number(s.monthly_fee),
        feeDueDay: s.fee_due_day,
        status: s.status,
        whatsappOptIn: s.whatsapp_opt_in !== false,
        enrolledBatches,
        batchId: enrolledBatches[0]?.id || '',
        batchName: enrolledBatches[0]?.name || '',
        // Fee fields strictly Admin-scoped
        currentMonthFeeStatus: requestingUser.role === ROLES.ADMIN ? (feeInfo?.status || 'NOT_ASSIGNED') : undefined,
        currentMonthPendingAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.pendingAmount || 0) : undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      };
    });

    if (query.search) {
      const q = query.search.toLowerCase();
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.parentName.toLowerCase().includes(q) ||
          s.studentMobile.toLowerCase().includes(q) ||
          s.parentWhatsapp.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.course.toLowerCase().includes(q)
      );
    }

    return students;
  }

  /**
   * Get student details by ID
   */
  static async getStudentById(id: string, requestingUser: AuthenticatedUser) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        parent_name,
        student_mobile,
        parent_whatsapp,
        email,
        course,
        admission_date,
        monthly_fee,
        fee_due_day,
        status,
        whatsapp_opt_in,
        created_at,
        updated_at,
        batch_students (
          batch_id,
          status,
          joined_at,
          batches (
            id,
            name,
            subject,
            schedule_days,
            start_time,
            end_time,
            status
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const activeBatchLinks = (student.batch_students || []).filter(
      (bs: any) => bs.status === STATUS.ACTIVE || !bs.status
    );

    const enrolledBatches = activeBatchLinks
      .map((bs: any) => ({
        ...bs.batches,
        enrollmentStatus: bs.status || STATUS.ACTIVE,
        joinedAt: bs.joined_at,
      }))
      .filter((b: any) => b && b.id);

    // If teacher is requesting, check if student is in at least one of their assigned batches
    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        throw new AppError('Unauthorized access to student record.', 403, 'FORBIDDEN');
      }

      const { data: assignment } = await supabaseAdmin
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', requestingUser.teacherId)
        .in(
          'batch_id',
          enrolledBatches.map((b: any) => b.id)
        );

      if (!assignment || assignment.length === 0) {
        throw new AppError('You are not authorized to view students outside your assigned batches.', 403, 'FORBIDDEN');
      }
    }

    // Current month identifier in YYYY-MM
    const now = new Date();
    const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentMonthFeeStatus: string | undefined = undefined;
    let currentMonthPendingAmount: number | undefined = undefined;
    let feeHistory: any[] | undefined = undefined;

    if (requestingUser.role === ROLES.ADMIN) {
      const { data: fees } = await supabaseAdmin
        .from('student_fees')
        .select('id, billing_period, amount_due, amount_paid, due_date, status, created_at')
        .eq('student_id', id)
        .order('billing_period', { ascending: false });

      if (fees && fees.length > 0) {
        feeHistory = fees.map((f: any) => {
          const amountDue = Number(f.amount_due || 0);
          const amountPaid = Number(f.amount_paid || 0);
          const pendingAmount = Math.max(0, amountDue - amountPaid);
          let currentStatus = f.status || 'PENDING';
          if (pendingAmount <= 0) {
            currentStatus = 'PAID';
          } else if (amountPaid > 0) {
            currentStatus = 'PARTIAL';
          } else if (new Date(f.due_date) < today) {
            currentStatus = 'OVERDUE';
          } else {
            currentStatus = 'PENDING';
          }

          if (f.billing_period === currentBillingPeriod) {
            currentMonthFeeStatus = currentStatus;
            currentMonthPendingAmount = pendingAmount;
          }

          return {
            id: f.id,
            billingPeriod: f.billing_period,
            amountDue,
            amountPaid,
            pendingAmount,
            dueDate: f.due_date,
            status: currentStatus,
            createdAt: f.created_at,
          };
        });
      }

      if (!currentMonthFeeStatus) {
        currentMonthFeeStatus = 'NOT_ASSIGNED';
        currentMonthPendingAmount = 0;
      }
    }

    // Query attendance records for this student
    const { data: attendanceData } = await supabaseAdmin
      .from('attendance')
      .select(`
        id,
        batch_id,
        date,
        status,
        batches (
          id,
          name
        )
      `)
      .eq('student_id', id)
      .order('date', { ascending: false });

    const totalSessions = (attendanceData || []).length;
    const presentCount = (attendanceData || []).filter((a: any) => a.status === 'PRESENT').length;
    const absentCount = (attendanceData || []).filter((a: any) => a.status === 'ABSENT').length;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    const attendanceHistory = (attendanceData || []).map((a: any) => ({
      id: a.id,
      batchId: a.batch_id,
      batchName: (Array.isArray(a.batches) ? a.batches[0]?.name : a.batches?.name) || 'Batch',
      attendanceDate: a.date,
      status: a.status,
    }));

    return {
      id: student.id,
      name: student.name,
      parentName: student.parent_name || '',
      studentMobile: student.student_mobile || '',
      parentWhatsapp: student.parent_whatsapp || '',
      email: student.email || '',
      course: student.course || '',
      admissionDate: student.admission_date,
      monthlyFee: Number(student.monthly_fee),
      feeDueDay: student.fee_due_day,
      status: student.status,
      whatsappOptIn: student.whatsapp_opt_in !== false,
      enrolledBatches,
      batchId: enrolledBatches[0]?.id || '',
      batchName: enrolledBatches[0]?.name || '',
      currentMonthFeeStatus,
      currentMonthPendingAmount,
      feeHistory,
      attendanceStats: {
        totalSessions,
        presentCount,
        absentCount,
        attendanceRate,
      },
      attendanceHistory,
      createdAt: student.created_at,
      updatedAt: student.updated_at,
    };
  }

  /**
   * Create a student (Admin only)
   */
  static async createStudent(dto: CreateStudentDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Phone validation & normalization
    let normalizedParentWhatsapp = null;
    if (dto.parentWhatsapp && dto.parentWhatsapp.trim()) {
      const pCheck = validatePhoneNumber(dto.parentWhatsapp, false);
      if (!pCheck.valid) {
        throw new AppError(pCheck.error || 'Invalid parent WhatsApp number format', 400, 'INVALID_PHONE');
      }
      normalizedParentWhatsapp = pCheck.normalized;
    }

    let normalizedStudentMobile = null;
    if (dto.studentMobile && dto.studentMobile.trim()) {
      const sCheck = validatePhoneNumber(dto.studentMobile, false);
      if (!sCheck.valid) {
        throw new AppError(sCheck.error || 'Invalid student mobile number format', 400, 'INVALID_PHONE');
      }
      normalizedStudentMobile = sCheck.normalized;
    }

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .insert({
        name: dto.name,
        parent_name: dto.parentName || null,
        student_mobile: normalizedStudentMobile,
        parent_whatsapp: normalizedParentWhatsapp,
        email: dto.email || null,
        course: dto.course || null,
        admission_date: dto.admissionDate || new Date().toISOString().split('T')[0],
        monthly_fee: dto.monthlyFee || 0,
        fee_due_day: dto.feeDueDay || 5,
        status: dto.status || STATUS.ACTIVE,
        whatsapp_opt_in: dto.whatsappOptIn !== undefined ? dto.whatsappOptIn : true,
      })
      .select()
      .single();

    if (error || !student) {
      throw new AppError(`Failed to create student: ${error?.message}`, 500);
    }

    // Handle batch enrollment (either direct batchId or initialBatchIds)
    const targetBatchIds: string[] = [];
    if (dto.batchId && dto.batchId.trim()) {
      targetBatchIds.push(dto.batchId.trim());
    } else if (dto.initialBatchIds && dto.initialBatchIds.length > 0) {
      targetBatchIds.push(...dto.initialBatchIds);
    }

    if (targetBatchIds.length > 0) {
      const enrollments = targetBatchIds.map((bId) => ({
        batch_id: bId,
        student_id: student.id,
        status: STATUS.ACTIVE,
      }));

      await supabaseAdmin
        .from('batch_students')
        .upsert(enrollments, { onConflict: 'batch_id,student_id' });
    }

    // Generate fee records: support both past/historical students and new enrollments
    if (dto.monthlyFee && Number(dto.monthlyFee) > 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const currentBillingPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const dueDay = dto.feeDueDay || 5;

      const feeRecordsToInsert: any[] = [];

      // Determine starting year & month if student has historical admissionDate and backfill is requested
      let startYear = currentYear;
      let startMonth = currentMonth;

      if (dto.admissionDate && dto.backfillPastFees) {
        const parts = dto.admissionDate.split('-');
        if (parts.length >= 2) {
          const admY = parseInt(parts[0], 10);
          const admM = parseInt(parts[1], 10);
          if (!isNaN(admY) && !isNaN(admM) && admM >= 1 && admM <= 12) {
            // Don't backfill more than 2 years in the past for sanity
            if (admY >= currentYear - 2) {
              startYear = admY;
              startMonth = admM - 1;
            }
          }
        }
      }

      // Loop month-by-month from startMonth up to currentMonth
      let curY = startYear;
      let curM = startMonth;

      while (curY < currentYear || (curY === currentYear && curM <= currentMonth)) {
        const periodStr = `${curY}-${String(curM + 1).padStart(2, '0')}`;
        const dueDate = new Date(curY, curM, Math.min(dueDay, 28)).toISOString().split('T')[0];
        const isPastPeriod = curY < currentYear || (curY === currentYear && curM < currentMonth);

        let feeStatus: 'PAID' | 'PENDING' = 'PENDING';
        let amountPaid = 0;

        if (isPastPeriod) {
          if (dto.pastFeesStatus === 'PAID') {
            feeStatus = 'PAID';
            amountPaid = Number(dto.monthlyFee);
          } else {
            feeStatus = 'PENDING';
            amountPaid = 0;
          }
        } else {
          // Current month is PENDING by default
          feeStatus = 'PENDING';
          amountPaid = 0;
        }

        feeRecordsToInsert.push({
          student_id: student.id,
          billing_period: periodStr,
          amount_due: Number(dto.monthlyFee),
          amount_paid: amountPaid,
          due_date: dueDate,
          status: feeStatus,
        });

        // Advance to next month
        curM++;
        if (curM > 11) {
          curM = 0;
          curY++;
        }
      }

      // Fallback: if no records were generated, ensure current month is present
      if (feeRecordsToInsert.length === 0) {
        const dueDate = new Date(currentYear, currentMonth, Math.min(dueDay, 28)).toISOString().split('T')[0];
        feeRecordsToInsert.push({
          student_id: student.id,
          billing_period: currentBillingPeriod,
          amount_due: Number(dto.monthlyFee),
          amount_paid: 0,
          due_date: dueDate,
          status: 'PENDING',
        });
      }

      try {
        await supabaseAdmin.from('student_fees').insert(feeRecordsToInsert);
      } catch (err: any) {
        console.warn('[StudentService] Fee assignment notice:', err?.message || err);
      }
    }

    // Automatic WhatsApp welcome message on student creation is explicitly disabled per user requirements
    // (Preserved for manual or opt-in dispatch if needed later)
    /*
    if (student.whatsapp_opt_in !== false) {
      const recipientPhone = normalizedParentWhatsapp || normalizedStudentMobile;
      if (recipientPhone) {
        automationService.triggerStudentWelcomeAutomation({
          parentPhone: recipientPhone,
          studentName: student.name,
          parentName: student.parent_name || undefined,
          course: student.course || undefined,
          monthlyFee: Number(student.monthly_fee) || undefined,
        }).catch((err) => console.warn('[StudentService] Welcome WhatsApp warning:', err.message));
      }
    }
    */

    return {
      id: student.id,
      name: student.name,
      parentName: student.parent_name,
      studentMobile: student.student_mobile,
      parentWhatsapp: student.parent_whatsapp,
      email: student.email,
      course: student.course,
      admissionDate: student.admission_date,
      monthlyFee: Number(student.monthly_fee),
      feeDueDay: student.fee_due_day,
      status: student.status,
      whatsappOptIn: student.whatsapp_opt_in !== false,
      batchId: targetBatchIds[0] || '',
      createdAt: student.created_at,
    };
  }

  /**
   * Update student (Admin only)
   */
  static async updateStudent(id: string, dto: UpdateStudentDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (dto.name) updates.name = dto.name;
    if (dto.parentName !== undefined) updates.parent_name = dto.parentName || null;
    
    if (dto.parentWhatsapp !== undefined) {
      if (dto.parentWhatsapp && dto.parentWhatsapp.trim()) {
        const pCheck = validatePhoneNumber(dto.parentWhatsapp, false);
        if (!pCheck.valid) {
          throw new AppError(pCheck.error || 'Invalid parent WhatsApp number', 400, 'INVALID_PHONE');
        }
        updates.parent_whatsapp = pCheck.normalized;
      } else {
        updates.parent_whatsapp = null;
      }
    }

    if (dto.studentMobile !== undefined) {
      if (dto.studentMobile && dto.studentMobile.trim()) {
        const sCheck = validatePhoneNumber(dto.studentMobile, false);
        if (!sCheck.valid) {
          throw new AppError(sCheck.error || 'Invalid student mobile number', 400, 'INVALID_PHONE');
        }
        updates.student_mobile = sCheck.normalized;
      } else {
        updates.student_mobile = null;
      }
    }

    if (dto.email !== undefined) updates.email = dto.email || null;
    if (dto.course !== undefined) updates.course = dto.course || null;
    if (dto.admissionDate) updates.admission_date = dto.admissionDate;
    if (dto.monthlyFee !== undefined) updates.monthly_fee = dto.monthlyFee;
    if (dto.feeDueDay !== undefined) updates.fee_due_day = dto.feeDueDay;
    if (dto.status) updates.status = dto.status;
    if (dto.whatsappOptIn !== undefined) updates.whatsapp_opt_in = dto.whatsappOptIn;

    const { data: updated, error } = await supabaseAdmin
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError(`Failed to update student: ${error?.message || 'Not found'}`, error ? 500 : 404);
    }

    // Handle batch update if batchId is provided
    if (dto.batchId !== undefined) {
      const newBatchId = dto.batchId ? dto.batchId.trim() : '';
      if (newBatchId) {
        // Deactivate any other batches for this student
        await supabaseAdmin
          .from('batch_students')
          .update({ status: STATUS.INACTIVE })
          .eq('student_id', id)
          .neq('batch_id', newBatchId);

        // Upsert new batch as ACTIVE
        await supabaseAdmin
          .from('batch_students')
          .upsert(
            {
              batch_id: newBatchId,
              student_id: id,
              status: STATUS.ACTIVE,
            },
            { onConflict: 'batch_id,student_id' }
          );
      } else {
        // Deactivate all batches if cleared
        await supabaseAdmin
          .from('batch_students')
          .update({ status: STATUS.INACTIVE })
          .eq('student_id', id);
      }
    }

    return {
      id: updated.id,
      name: updated.name,
      parentName: updated.parent_name,
      studentMobile: updated.student_mobile,
      parentWhatsapp: updated.parent_whatsapp,
      email: updated.email,
      course: updated.course,
      admissionDate: updated.admission_date,
      monthlyFee: Number(updated.monthly_fee),
      feeDueDay: updated.fee_due_day,
      status: updated.status,
      whatsappOptIn: updated.whatsapp_opt_in !== false,
      batchId: dto.batchId !== undefined ? dto.batchId : undefined,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * Toggle student status (Activate / Deactivate)
   */
  static async setStudentStatus(id: string, targetStatus: 'ACTIVE' | 'INACTIVE') {
    return this.updateStudent(id, { status: targetStatus });
  }

  /**
   * Permanently delete a student and cleanup relationships safely
   */
  static async deleteStudent(id: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // 1. Delete enrollments
    await supabaseAdmin.from('batch_students').delete().eq('student_id', id);

    // 2. Delete attendance records
    await supabaseAdmin.from('attendance').delete().eq('student_id', id);

    // 3. Delete payments & student fees
    await supabaseAdmin.from('payments').delete().eq('student_id', id);
    await supabaseAdmin.from('student_fees').delete().eq('student_id', id);

    // 4. Delete messages & queue
    await supabaseAdmin.from('whatsapp_messages').delete().eq('student_id', id);
    await supabaseAdmin.from('whatsapp_queue').delete().eq('student_id', id);

    // 5. Delete student record
    const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
    if (error) {
      throw new AppError(`Failed to delete student: ${error.message}`, 500);
    }

    return { id, success: true };
  }
}
