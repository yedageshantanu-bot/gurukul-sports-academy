import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { CreateStudentDTO, UpdateStudentDTO } from '../types/crm.types.js';
import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phone.js';
import { automationService } from './whatsapp/automation.service.js';
import { RankService } from './rank.service.js';
import { memoryCache } from '../utils/cache.js';

export class StudentService {
  /**
   * List students with filtering and role-based scope
   * Admin: can see all students
   * Teacher: can ONLY see students enrolled in batches assigned to them
   */
  static async listStudents(
    query: { search?: string; status?: string; batchId?: string; limit?: number; page?: number },
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

    if (query.limit && query.limit > 0) {
      const page = query.page && query.page > 0 ? query.page : 1;
      const from = (page - 1) * query.limit;
      const to = from + query.limit - 1;
      dbQuery = dbQuery.range(from, to);
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

    // If Admin, query fee status across all billing records for each student
    const studentFeeMap = new Map<string, {
      status: string;
      pendingAmount: number;
      totalPendingAmount: number;
      totalDue: number;
      totalPaid: number;
      overdueCount: number;
    }>();
    const studentRanksMap = new Map<string, any[]>();

    if (data && data.length > 0) {
      const studentIds = data.map((s: any) => s.id);

      if (requestingUser.role === ROLES.ADMIN) {
        const { data: fees } = await supabaseAdmin
          .from('student_fees')
          .select('student_id, amount_due, amount_paid, due_date, status, billing_period')
          .in('student_id', studentIds);

        // Group fees by student
        const feesByStudent = new Map<string, any[]>();
        (fees || []).forEach((f: any) => {
          const list = feesByStudent.get(f.student_id) || [];
          list.push(f);
          feesByStudent.set(f.student_id, list);
        });

        studentIds.forEach((sId: string) => {
          const studentFees = feesByStudent.get(sId) || [];
          if (studentFees.length === 0) return;

          let totalDue = 0;
          let totalPaid = 0;
          let overdueCount = 0;

          studentFees.forEach((f: any) => {
            const due = Number(f.amount_due || 0);
            const paid = Number(f.amount_paid || 0);
            const pending = Math.max(0, due - paid);
            totalDue += due;
            totalPaid += paid;

            const isOverdue = pending > 0 && new Date(f.due_date) < today;
            if (isOverdue) overdueCount++;
          });

          const totalPending = Math.max(0, totalDue - totalPaid);
          let overallStatus = 'PENDING';
          if (totalPending <= 0) {
            overallStatus = 'PAID';
          } else if (overdueCount > 0) {
            overallStatus = 'OVERDUE';
          } else if (totalPaid > 0) {
            overallStatus = 'PARTIAL';
          } else {
            overallStatus = 'PENDING';
          }

          studentFeeMap.set(sId, {
            status: overallStatus,
            pendingAmount: totalPending,
            totalPendingAmount: totalPending,
            totalDue,
            totalPaid,
            overdueCount,
          });
        });
      }

      // Query active martial arts ranks & belts for all fetched students
      try {
        const { data: srData } = await supabaseAdmin
          .from('student_ranks')
          .select(`
            id,
            student_id,
            discipline_code,
            reg_number,
            promoted_at,
            promoted_by,
            martial_arts_ranks (
              rank_name,
              belt_color
            )
          `)
          .in('student_id', studentIds);

        (srData || []).forEach((sr: any) => {
          const list = studentRanksMap.get(sr.student_id) || [];
          list.push({
            id: sr.id,
            disciplineCode: sr.discipline_code,
            disciplineName: sr.discipline_code === 'KALARIPPAYATTU'
              ? 'Kalarippayattu'
              : sr.discipline_code === 'KARATE_WUSHU'
              ? 'Karate + Wushu'
              : sr.discipline_code === 'KICKBOXING'
              ? 'Kickboxing'
              : sr.discipline_code === 'GYMNASTICS'
              ? 'Gymnastics'
              : 'Martial Arts',
            regNumber: sr.reg_number,
            promotedAt: sr.promoted_at,
            promotedBy: sr.promoted_by,
            rankName: (sr.martial_arts_ranks as any)?.rank_name || 'Active Grade',
            beltColor: (sr.martial_arts_ranks as any)?.belt_color || 'Yellow',
          });
          studentRanksMap.set(sr.student_id, list);
        });
      } catch (err) {
        console.warn('student_ranks query fallback in getAllStudents:', err);
      }
    }

    let students = (data || []).map((s: any) => {
      const activeBatchLinks = (s.batch_students || []).filter(
        (bs: any) => bs.status === STATUS.ACTIVE || !bs.status
      );
      const enrolledBatches = activeBatchLinks
        .map((bs: any) => bs.batches)
        .filter(Boolean);

      const feeInfo = studentFeeMap.get(s.id);
      const ranks = studentRanksMap.get(s.id) || [];

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
        martialArtsRanks: ranks,
        // Fee fields strictly Admin-scoped
        currentMonthFeeStatus: requestingUser.role === ROLES.ADMIN ? (feeInfo?.status || 'NOT_ASSIGNED') : undefined,
        currentMonthPendingAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.pendingAmount || 0) : undefined,
        feeStatus: requestingUser.role === ROLES.ADMIN ? (feeInfo?.status || 'NOT_ASSIGNED') : undefined,
        totalPendingAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.totalPendingAmount ?? 0) : undefined,
        totalDueAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.totalDue || 0) : undefined,
        totalPaidAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.totalPaid || 0) : undefined,
        overdueMonthsCount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.overdueCount || 0) : undefined,
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
          s.course.toLowerCase().includes(q) ||
          s.batchName.toLowerCase().includes(q) ||
          (s.martialArtsRanks && s.martialArtsRanks.some((r: any) =>
            r.rankName?.toLowerCase().includes(q) ||
            r.beltColor?.toLowerCase().includes(q) ||
            r.disciplineName?.toLowerCase().includes(q)
          ))
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
    let feeHistory: any[] = [];

    if (requestingUser.role === ROLES.ADMIN || requestingUser.role === ROLES.DEMO_ADMIN) {
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

    const totalDueAmount = feeHistory.reduce((acc: number, f: any) => acc + (f.amountDue || 0), 0);
    const totalPaidAmount = feeHistory.reduce((acc: number, f: any) => acc + (f.amountPaid || 0), 0);
    const totalPendingAmount = Math.max(0, totalDueAmount - totalPaidAmount);
    const overdueMonthsCount = feeHistory.filter((f: any) => f.status === 'OVERDUE').length;
    let overallFeeStatus = 'PENDING';
    if (feeHistory.length === 0) overallFeeStatus = 'NOT_ASSIGNED';
    else if (totalPendingAmount <= 0) overallFeeStatus = 'PAID';
    else if (overdueMonthsCount > 0) overallFeeStatus = 'OVERDUE';
    else if (totalPaidAmount > 0) overallFeeStatus = 'PARTIAL';
    else overallFeeStatus = 'PENDING';

    // Query martial arts ranks and promotion history for this student
    let martialArtsRanks: any[] = [];
    let rankHistory: any[] = [];
    try {
      const { data: srData } = await supabaseAdmin
        .from('student_ranks')
        .select(`
          id,
          discipline_code,
          reg_number,
          dob,
          represented_from,
          promoted_at,
          promoted_by,
          martial_arts_ranks (
            id,
            rank_order,
            rank_name,
            belt_color,
            badge_bg,
            badge_text
          )
        `)
        .eq('student_id', id);

      if (srData) {
        martialArtsRanks = srData.map((sr: any) => ({
          id: sr.id,
          disciplineCode: sr.discipline_code,
          disciplineName: sr.discipline_code === 'KALARIPPAYATTU'
            ? 'Kalarippayattu'
            : sr.discipline_code === 'KARATE_WUSHU'
            ? 'Karate + Wushu'
            : 'Both (Dual Discipline)',
          regNumber: sr.reg_number,
          dob: sr.dob,
          representedFrom: sr.represented_from,
          promotedAt: sr.promoted_at,
          promotedBy: sr.promoted_by,
          rankName: (sr.martial_arts_ranks as any)?.rank_name || 'Beginner',
          beltColor: (sr.martial_arts_ranks as any)?.belt_color || 'Yellow',
          rankOrder: (sr.martial_arts_ranks as any)?.rank_order || 1,
        }));
      }

      const { data: promData } = await supabaseAdmin
        .from('rank_promotions')
        .select(`
          id,
          discipline_code,
          previous_rank_name,
          new_rank_id,
          new_rank_name,
          reg_number,
          promotion_date,
          promoted_by,
          certificate_number,
          created_at,
          martial_arts_ranks (
            belt_color,
            badge_bg,
            badge_text
          )
        `)
        .eq('student_id', id)
        .order('promotion_date', { ascending: false });

      if (promData) {
        rankHistory = promData.map((p: any) => ({
          id: p.id,
          disciplineCode: p.discipline_code,
          previousRankName: p.previous_rank_name || 'Beginner',
          newRankName: p.new_rank_name,
          regNumber: p.reg_number,
          promotionDate: p.promotion_date || p.created_at,
          promotedBy: p.promoted_by,
          certificateNumber: p.certificate_number,
          beltColor: (p.martial_arts_ranks as any)?.belt_color || 'Yellow',
        }));
      }
    } catch (rErr) {
      console.warn('Rank query fallback in getStudentById:', rErr);
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
      feeStatus: overallFeeStatus,
      totalPendingAmount,
      totalDueAmount,
      totalPaidAmount,
      overdueMonthsCount,
      feeHistory,
      martialArtsRanks,
      rankHistory,
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

    // Handle batch enrollment (supports multiple batches in initialBatchIds or batchIds)
    const targetBatchIds = new Set<string>();
    if (Array.isArray(dto.initialBatchIds) && dto.initialBatchIds.length > 0) {
      dto.initialBatchIds.forEach((bId) => { if (bId && bId.trim()) targetBatchIds.add(bId.trim()); });
    }
    if (Array.isArray(dto.batchIds) && dto.batchIds.length > 0) {
      dto.batchIds.forEach((bId) => { if (bId && bId.trim()) targetBatchIds.add(bId.trim()); });
    }
    if (dto.batchId && dto.batchId.trim()) {
      targetBatchIds.add(dto.batchId.trim());
    }

    if (targetBatchIds.size > 0) {
      const enrollments = Array.from(targetBatchIds).map((bId) => ({
        batch_id: bId,
        student_id: student.id,
        status: STATUS.ACTIVE,
      }));

      await supabaseAdmin
        .from('batch_students')
        .upsert(enrollments, { onConflict: 'batch_id,student_id' });
    }

    // 1. Martial Arts / Sports Direct Enrollment into Belt Registry (supports 1 or 2+ sports)
    if (dto.sports && Array.isArray(dto.sports) && dto.sports.length > 0) {
      for (const sp of dto.sports) {
        if (sp.disciplineCode && sp.disciplineCode !== 'NONE') {
          try {
            await RankService.assignStudentRank({
              studentId: student.id,
              disciplineCode: sp.disciplineCode,
              rankName: sp.rankName || undefined,
            });
          } catch (err: any) {
            console.warn('[StudentService] Martial Arts Belt enrollment notice:', err?.message || err);
          }
        }
      }
    } else if (dto.sportDiscipline && dto.sportDiscipline !== 'NONE') {
      try {
        await RankService.assignStudentRank({
          studentId: student.id,
          disciplineCode: dto.sportDiscipline,
          rankName: dto.initialBeltRank || undefined,
        });
      } catch (err: any) {
        console.warn('[StudentService] Martial Arts Belt enrollment notice:', err?.message || err);
      }
    }

    // 2. Generate fee records: Support Zero-Confusion Paid-Up-To, Yearly Packages, and Monthly cycles
    if (dto.monthlyFee && Number(dto.monthlyFee) > 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const currentBillingPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const dueDay = dto.feeDueDay || 5;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const feeRecordsToInsert: any[] = [];

      // CASE A: YEARLY FEE PACKAGE (Full, Installments / Partial, or Unpaid)
      if (dto.feeFrequency === 'YEARLY' || dto.feePaymentType === 'YEARLY_PAID' || dto.feePaymentType === 'YEARLY_PARTIAL') {
        const totalAnnualFee = Number(dto.monthlyFee);
        const yearlyPeriodStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}_YEARLY`;
        
        let amountPaid = totalAnnualFee;
        let feeStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PAID';
        let dueDate = dto.nextInstallmentDueDate || new Date(currentYear, currentMonth, Math.min(dueDay, 28)).toISOString().split('T')[0];

        if (dto.feePaymentType === 'YEARLY_PARTIAL') {
          amountPaid = Math.min(totalAnnualFee, Number(dto.initialPaymentAmount) || 0);
          feeStatus = amountPaid >= totalAnnualFee ? 'PAID' : (amountPaid > 0 ? 'PARTIAL' : 'PENDING');
        } else if (dto.feePaymentType === 'UNPAID_PENDING') {
          amountPaid = 0;
          feeStatus = 'PENDING';
        } else {
          // Default YEARLY_PAID: full 1-year payment
          amountPaid = totalAnnualFee;
          feeStatus = 'PAID';
        }

        feeRecordsToInsert.push({
          student_id: student.id,
          billing_period: yearlyPeriodStr,
          amount_due: totalAnnualFee,
          amount_paid: amountPaid,
          due_date: dueDate,
          status: feeStatus,
        });
      }
      // CASE B: "PAID UP TO" SMART SELECTOR (Zero math: e.g. paid up to Sept 2026, Oct 2026 is due)
      else if (dto.feePaymentType === 'PAID_UP_TO' && dto.paidUpToMonth) {
        let startYear = currentYear;
        let startMonth = currentMonth;

        if (dto.admissionDate) {
          const parts = dto.admissionDate.split('-');
          if (parts.length >= 2) {
            const admY = parseInt(parts[0], 10);
            const admM = parseInt(parts[1], 10);
            if (!isNaN(admY) && !isNaN(admM) && admM >= 1 && admM <= 12) {
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
          const isCleared = periodStr <= dto.paidUpToMonth;

          let feeStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIALLY_PAID' = 'PENDING';
          let amountPaid = 0;

          if (isCleared) {
            feeStatus = 'PAID';
            amountPaid = Number(dto.monthlyFee);
          } else {
            // Unpaid month (e.g. current month October if paidUpTo was September)
            feeStatus = new Date(dueDate) < today ? 'OVERDUE' : 'PENDING';
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

          curM++;
          if (curM > 11) {
            curM = 0;
            curY++;
          }
        }
      }
      // CASE C: STANDARD MONTHLY / ADMISSION BACKFILL FLOW
      else {
        let startYear = currentYear;
        let startMonth = currentMonth;

        if (dto.admissionDate && dto.backfillPastFees !== false) {
          const parts = dto.admissionDate.split('-');
          if (parts.length >= 2) {
            const admY = parseInt(parts[0], 10);
            const admM = parseInt(parts[1], 10);
            if (!isNaN(admY) && !isNaN(admM) && admM >= 1 && admM <= 12) {
              if (admY >= currentYear - 2) {
                startYear = admY;
                startMonth = admM - 1;
              }
            }
          }
        }

        let curY = startYear;
        let curM = startMonth;

        while (curY < currentYear || (curY === currentYear && curM <= currentMonth)) {
          const periodStr = `${curY}-${String(curM + 1).padStart(2, '0')}`;
          const dueDate = new Date(curY, curM, Math.min(dueDay, 28)).toISOString().split('T')[0];
          const isPastPeriod = curY < currentYear || (curY === currentYear && curM < currentMonth);

          let feeStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIALLY_PAID' = 'PENDING';
          let amountPaid = 0;

          if (isPastPeriod) {
            if (dto.pastFeesStatus === 'PAID') {
              feeStatus = 'PAID';
              amountPaid = Number(dto.monthlyFee);
            } else {
              feeStatus = 'OVERDUE';
              amountPaid = 0;
            }
          } else {
            // Current month: Apply initial payment amount if provided
            const initialPaid = Number(dto.initialPaymentAmount) || 0;
            amountPaid = initialPaid;
            if (initialPaid >= Number(dto.monthlyFee) && Number(dto.monthlyFee) > 0) {
              feeStatus = 'PAID';
            } else if (initialPaid > 0) {
              feeStatus = 'PARTIALLY_PAID';
            } else if (new Date(dueDate) < today) {
              feeStatus = 'OVERDUE';
            } else {
              feeStatus = 'PENDING';
            }
          }

          feeRecordsToInsert.push({
            student_id: student.id,
            billing_period: periodStr,
            amount_due: Number(dto.monthlyFee),
            amount_paid: amountPaid,
            due_date: dueDate,
            status: feeStatus,
          });

          curM++;
          if (curM > 11) {
            curM = 0;
            curY++;
          }
        }
      }

      // Fallback: if no records were generated, ensure current month is present
      if (feeRecordsToInsert.length === 0) {
        const dueDate = new Date(currentYear, currentMonth, Math.min(dueDay, 28)).toISOString().split('T')[0];
        const initialPaid = Number(dto.initialPaymentAmount) || 0;
        let fallbackStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIALLY_PAID' = 'PENDING';
        if (initialPaid >= Number(dto.monthlyFee) && Number(dto.monthlyFee) > 0) {
          fallbackStatus = 'PAID';
        } else if (initialPaid > 0) {
          fallbackStatus = 'PARTIALLY_PAID';
        } else if (new Date(dueDate) < today) {
          fallbackStatus = 'OVERDUE';
        }

        feeRecordsToInsert.push({
          student_id: student.id,
          billing_period: currentBillingPeriod,
          amount_due: Number(dto.monthlyFee),
          amount_paid: initialPaid,
          due_date: dueDate,
          status: fallbackStatus,
        });
      }

      try {
        await supabaseAdmin.from('student_fees').insert(feeRecordsToInsert);

        // If an initial payment amount was collected during admission, log it in payments table
        const initialPaid = Number(dto.initialPaymentAmount) || 0;
        const totalPaidToLog = dto.feePaymentType === 'YEARLY_PAID'
          ? Number(dto.monthlyFee)
          : (dto.feePaymentType === 'UNPAID_PENDING' ? 0 : initialPaid);

        if (totalPaidToLog > 0) {
          const { data: createdFee } = await supabaseAdmin
            .from('student_fees')
            .select('id')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const method = dto.paymentMethod || 'CASH';
          await supabaseAdmin.from('payments').insert({
            student_id: student.id,
            student_fee_id: createdFee?.id || null,
            amount: totalPaidToLog,
            payment_method: method,
            status: 'SUCCESS',
            notes: dto.paymentNotes || (dto.feeFrequency === 'YEARLY' ? 'Annual / Yearly Course Fee Settlement' : 'Admission fee settlement at enrollment'),
            transaction_id: `adm_pay_${Date.now()}`,
          });
        }
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

    const result = {
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
      batchId: Array.from(targetBatchIds)[0] || '',
      createdAt: student.created_at,
    };

    memoryCache.invalidateTag('dashboard');
    return result;
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
    if (dto.admissionDate && dto.admissionDate.trim()) {
      updates.admission_date = dto.admissionDate.trim();
    }
    if (dto.monthlyFee !== undefined && !isNaN(Number(dto.monthlyFee))) {
      updates.monthly_fee = Number(dto.monthlyFee);
    }
    if (dto.feeDueDay !== undefined && !isNaN(Number(dto.feeDueDay))) {
      updates.fee_due_day = Number(dto.feeDueDay);
    }
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

    // Handle batch update if batchId or batchIds is provided
    const requestedBatchIds: string[] = [];
    if (dto.batchIds && Array.isArray(dto.batchIds)) {
      requestedBatchIds.push(...dto.batchIds.filter((b): b is string => typeof b === 'string' && b.trim().length > 0));
    } else if (dto.initialBatchIds && Array.isArray(dto.initialBatchIds)) {
      requestedBatchIds.push(...dto.initialBatchIds.filter((b): b is string => typeof b === 'string' && b.trim().length > 0));
    } else if (dto.batchId !== undefined) {
      if (dto.batchId && dto.batchId.trim()) requestedBatchIds.push(dto.batchId.trim());
    }

    if (dto.batchIds !== undefined || dto.initialBatchIds !== undefined || dto.batchId !== undefined) {
      if (requestedBatchIds.length > 0) {
        // Fetch current active enrollments
        const { data: currentEnrollments } = await supabaseAdmin
          .from('batch_students')
          .select('id, batch_id')
          .eq('student_id', id)
          .eq('status', STATUS.ACTIVE);

        const current = currentEnrollments || [];
        const toDeactivate = current
          .filter((row: any) => !requestedBatchIds.includes(row.batch_id))
          .map((row: any) => row.id);

        if (toDeactivate.length > 0) {
          await supabaseAdmin
            .from('batch_students')
            .update({ status: STATUS.INACTIVE })
            .in('id', toDeactivate);
        }

        // Upsert requested batches as ACTIVE
        const batchRows = requestedBatchIds.map((bId) => ({
          batch_id: bId,
          student_id: id,
          status: STATUS.ACTIVE,
        }));

        await supabaseAdmin
          .from('batch_students')
          .upsert(batchRows, { onConflict: 'batch_id,student_id' });
      } else {
        // Deactivate all batches if cleared
        await supabaseAdmin
          .from('batch_students')
          .update({ status: STATUS.INACTIVE })
          .eq('student_id', id);
      }
    }

    // Update Martial Arts / Sports Belt Ranks if provided
    if (dto.sports && Array.isArray(dto.sports) && dto.sports.length > 0) {
      for (const sp of dto.sports) {
        if (sp.disciplineCode && sp.disciplineCode !== 'NONE') {
          try {
            await RankService.assignStudentRank({
              studentId: id,
              disciplineCode: sp.disciplineCode,
              rankName: sp.rankName || undefined,
            });
          } catch (err: any) {
            console.warn('[StudentService] Update Martial Arts Belt notice:', err?.message || err);
          }
        }
      }
    } else if (dto.sportDiscipline && dto.sportDiscipline !== 'NONE') {
      try {
        await RankService.assignStudentRank({
          studentId: id,
          disciplineCode: dto.sportDiscipline,
          rankName: dto.initialBeltRank || undefined,
        });
      } catch (err: any) {
        console.warn('[StudentService] Update Martial Arts Belt notice:', err?.message || err);
      }
    }

    // If monthly fee updated, adjust current unpaid fee record if pending
    if (dto.monthlyFee !== undefined && !isNaN(Number(dto.monthlyFee))) {
      const now = new Date();
      const curPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        await supabaseAdmin
          .from('student_fees')
          .update({ amount_due: Number(dto.monthlyFee) })
          .eq('student_id', id)
          .eq('billing_period', curPeriod)
          .eq('amount_paid', 0);
      } catch (fErr: any) {
        console.warn('[StudentService] Update fee due notice:', fErr?.message || fErr);
      }
    }

    memoryCache.invalidateTag('dashboard');

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
   * Permanently delete a student and cascade cleanup all child records:
   * fees, payments, receipts, attendance, tournament registrations, ranks, and enrollments
   */
  static async deleteStudent(id: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // 1. Delete enrollments
    await supabaseAdmin.from('batch_students').delete().eq('student_id', id);

    // 2. Delete attendance records
    await supabaseAdmin.from('attendance').delete().eq('student_id', id);

    // 3. Delete receipts (references payment and student)
    await supabaseAdmin.from('receipts').delete().eq('student_id', id);

    // 4. Delete payments & student fee accounts (no orphan fees!)
    await supabaseAdmin.from('payments').delete().eq('student_id', id);
    await supabaseAdmin.from('student_fees').delete().eq('student_id', id);

    // 5. Delete tournament registrations
    await supabaseAdmin.from('tournament_registrations').delete().eq('student_id', id);

    // 6. Delete publication enrollments if any
    await supabaseAdmin.from('publication_students').delete().eq('student_id', id);

    // 7. Delete student ranks and promotion history
    await supabaseAdmin.from('student_ranks').delete().eq('student_id', id);

    // 8. Delete messages & queue
    await supabaseAdmin.from('whatsapp_messages').delete().eq('student_id', id);
    await supabaseAdmin.from('whatsapp_queue').delete().eq('student_id', id);

    // 9. Delete student record
    const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
    if (error) {
      throw new AppError(`Failed to delete student: ${error.message}`, 500);
    }

    memoryCache.invalidateTag('dashboard');
    memoryCache.invalidateTag('students');
    memoryCache.invalidateTag('fees');
    memoryCache.invalidateTag('payments');
    return { id, success: true };
  }
}
