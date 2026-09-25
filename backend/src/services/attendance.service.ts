import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { BulkAttendanceDTO, UpdateAttendanceDTO, AttendanceSheetStudent } from '../types/attendance.types.js';
import { automationService } from './whatsapp/automation.service.js';

export class AttendanceService {
  /**
   * Get attendance sheet for a specific batch on a given date.
   * Prefills existing marked status or defaults to UNMARKED.
   */
  static async getBatchAttendanceSheet(
    batchId: string,
    date: string,
    requestingUser: AuthenticatedUser
  ) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Role check: Teachers must be assigned to this batch
    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        throw new AppError('Unauthorized access to batch attendance.', 403, 'FORBIDDEN');
      }

      const { data: assignment } = await supabaseAdmin
        .from('batch_teachers')
        .select('id')
        .eq('batch_id', batchId)
        .eq('teacher_id', requestingUser.teacherId)
        .single();

      if (!assignment) {
        throw new AppError('You are not authorized to access attendance for this unassigned batch.', 403, 'FORBIDDEN');
      }
    }

    // 1. Verify batch exists
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, name, subject, schedule_days, start_time, end_time')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      throw new AppError('Batch not found', 404, 'NOT_FOUND');
    }

    // 2. Fetch enrolled active students for this batch
    const { data: enrolledStudents, error: enrollError } = await supabaseAdmin
      .from('batch_students')
      .select(`
        student_id,
        students!inner (
          id,
          name,
          student_mobile,
          parent_whatsapp,
          status
        )
      `)
      .eq('batch_id', batchId)
      .eq('status', STATUS.ACTIVE);

    if (enrollError) {
      throw new AppError(`Failed to fetch enrolled students: ${enrollError.message}`, 500);
    }

    // 3. Fetch any existing attendance records marked for this batch + date
    const { data: existingRecords, error: attError } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, status, teacher_id')
      .eq('batch_id', batchId)
      .eq('date', date);

    if (attError) {
      throw new AppError(`Failed to fetch existing attendance: ${attError.message}`, 500);
    }

    const attendanceMap = new Map<string, { id: string; status: 'PRESENT' | 'ABSENT' }>();
    (existingRecords || []).forEach((r) => {
      attendanceMap.set(r.student_id, { id: r.id, status: r.status as 'PRESENT' | 'ABSENT' });
    });

    // 4. Check for fee defaulters (unpaid fees overdue for 3+ days)
    const enrolledStudentIds = (enrolledStudents || []).map((es: any) => es.students?.id).filter(Boolean);
    const feeOverdueMap = new Map<string, { isOverdue: boolean; daysOverdue: number; pendingAmount: number }>();

    if (enrolledStudentIds.length > 0) {
      try {
        const { data: feesData } = await supabaseAdmin
          .from('student_fees')
          .select('student_id, amount_due, amount_paid, due_date')
          .in('student_id', enrolledStudentIds);

        const todayMs = new Date().setHours(0, 0, 0, 0);
        (feesData || []).forEach((f: any) => {
          const pending = Math.max(0, Number(f.amount_due) - Number(f.amount_paid));
          if (pending > 0 && f.due_date) {
            const dueMs = new Date(f.due_date).getTime();
            const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
            if (daysOverdue >= 3) {
              const existing = feeOverdueMap.get(f.student_id);
              if (!existing || daysOverdue > existing.daysOverdue) {
                feeOverdueMap.set(f.student_id, {
                  isOverdue: true,
                  daysOverdue,
                  pendingAmount: (existing?.pendingAmount || 0) + pending,
                });
              }
            }
          }
        });
      } catch (err: any) {
        console.warn('[AttendanceService] Notice: could not query fee overdue status:', err.message);
      }
    }

    const students: AttendanceSheetStudent[] = (enrolledStudents || [])
      .map((es: any) => {
        const student = es.students;
        const existing = attendanceMap.get(student.id);
        const feeOverdue = feeOverdueMap.get(student.id) || null;
        return {
          studentId: student.id,
          name: student.name,
          studentMobile: student.student_mobile || '',
          parentWhatsapp: student.parent_whatsapp || '',
          status: existing ? existing.status : ('UNMARKED' as const),
          attendanceId: existing?.id,
          feeOverdue,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      batch,
      date,
      totalEnrolled: students.length,
      markedCount: existingRecords?.length || 0,
      students,
    };
  }

  /**
   * Bulk mark or update attendance records for a batch.
   * Validates student enrollment and teacher batch assignment.
   */
  static async markBulkAttendance(dto: BulkAttendanceDTO, requestingUser: AuthenticatedUser) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    let resolvedTeacherId: string;

    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        throw new AppError('Teacher profile not linked to account.', 403, 'FORBIDDEN');
      }

      // Check teacher assignment
      const { data: assignment } = await supabaseAdmin
        .from('batch_teachers')
        .select('id')
        .eq('batch_id', dto.batchId)
        .eq('teacher_id', requestingUser.teacherId)
        .single();

      if (!assignment) {
        throw new AppError('You are not authorized to mark attendance for this unassigned batch.', 403, 'FORBIDDEN');
      }

      resolvedTeacherId = requestingUser.teacherId;
    } else {
      // Admin marking
      if (dto.teacherId) {
        resolvedTeacherId = dto.teacherId;
      } else {
        // Resolve first assigned teacher for batch
        const { data: batchTeacher } = await supabaseAdmin
          .from('batch_teachers')
          .select('teacher_id')
          .eq('batch_id', dto.batchId)
          .limit(1)
          .single();

        if (batchTeacher?.teacher_id) {
          resolvedTeacherId = batchTeacher.teacher_id;
        } else {
          // If batch has no assigned teacher, fallback to any active teacher in the system
          const { data: fallbackTeacher } = await supabaseAdmin
            .from('teachers')
            .select('id')
            .eq('status', STATUS.ACTIVE)
            .limit(1)
            .single();

          if (!fallbackTeacher?.id) {
            throw new AppError('Cannot mark attendance: No teachers exist in the academy.', 400);
          }
          resolvedTeacherId = fallbackTeacher.id;
        }
      }
    }

    // 1. Validate that all submitted students are actively enrolled in this batch
    const { data: enrolledStudents, error: enrollErr } = await supabaseAdmin
      .from('batch_students')
      .select('student_id')
      .eq('batch_id', dto.batchId)
      .eq('status', STATUS.ACTIVE);

    if (enrollErr || !enrolledStudents) {
      throw new AppError('Failed to verify batch enrollments', 500);
    }

    const enrolledStudentIds = new Set(enrolledStudents.map((es) => es.student_id));
    for (const record of dto.records) {
      if (!enrolledStudentIds.has(record.studentId)) {
        throw new AppError(
          `Student with ID ${record.studentId} is not enrolled in batch ${dto.batchId}`,
          400,
          'INVALID_STUDENT_ENROLLMENT'
        );
      }
    }

    // 1. Fetch existing attendance records for batch + date to detect status transitions
    const { data: existingRecords } = await supabaseAdmin
      .from('attendance')
      .select('id, student_id, status')
      .eq('batch_id', dto.batchId)
      .eq('date', dto.date);

    const previousStatusMap = new Map<string, string>();
    (existingRecords || []).forEach((r: any) => previousStatusMap.set(r.student_id, r.status));

    // 2. Prepare records for atomic upsert
    const now = new Date().toISOString();
    const rows = dto.records.map((r) => {
      const row: any = {
        student_id: r.studentId,
        batch_id: dto.batchId,
        teacher_id: resolvedTeacherId,
        date: dto.date,
        status: r.status,
        marked_at: now,
      };
      return row;
    });

    // Perform upsert on unique constraint (student_id, batch_id, date)
    const upsertResult = await supabaseAdmin
      .from('attendance')
      .upsert(rows, {
        onConflict: 'student_id,batch_id,date',
      })
      .select(`
        id,
        student_id,
        batch_id,
        teacher_id,
        date,
        status,
        marked_at,
        created_at
      `);

    if (upsertResult.error) {
      throw new AppError(`Failed to save attendance records: ${upsertResult.error.message}`, 500);
    }

    const data = (upsertResult.data || []).map((r: any) => ({
      ...r,
      attendance_date: r.date,
      attendanceDate: r.date,
    }));

    // 3. Trigger WhatsApp automations with 15-second anti-ban throttle
    const newlyAbsentIds: string[] = [];
    const correctedIds: string[] = [];

    for (const r of dto.records) {
      const prev = previousStatusMap.get(r.studentId);
      if (r.status === 'ABSENT' && prev !== 'ABSENT') {
        newlyAbsentIds.push(r.studentId);
      } else if (r.status === 'PRESENT' && prev === 'ABSENT') {
        correctedIds.push(r.studentId);
      }
    }

    if (newlyAbsentIds.length > 0 || correctedIds.length > 0) {
      (async () => {
        for (const studentId of newlyAbsentIds) {
          try {
            await automationService.triggerAbsentAttendanceAutomation({
              studentId,
              batchId: dto.batchId,
              date: dto.date,
            });
          } catch (e: any) {
            console.warn('[AttendanceService] WhatsApp absent notification error:', e.message);
          }
        }

        for (const studentId of correctedIds) {
          try {
            await automationService.triggerAttendanceCorrectionAutomation({
              studentId,
              batchId: dto.batchId,
              date: dto.date,
              correctedBy: requestingUser.profileId,
            });
          } catch (e: any) {
            console.warn('[AttendanceService] WhatsApp correction notification error:', e.message);
          }
        }
      })().catch((err) => console.warn('[AttendanceService] Background WhatsApp dispatch warning:', err.message));
    }

    return {
      batchId: dto.batchId,
      date: dto.date,
      recordedCount: data?.length || 0,
      records: data || [],
    };
  }

  /**
   * List historical attendance records with filters.
   */
  static async listAttendance(
    query: {
      batchId?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      studentId?: string;
    },
    requestingUser: AuthenticatedUser
  ) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    let allowedBatchIds: string[] | null = null;

    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        return [];
      }

      const { data: assignments } = await supabaseAdmin
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', requestingUser.teacherId);

      const batchIds = (assignments || []).map((a) => a.batch_id);

      if (query.batchId) {
        if (!batchIds.includes(query.batchId)) {
          throw new AppError('You are not authorized to view attendance for this unassigned batch.', 403, 'FORBIDDEN');
        }
        allowedBatchIds = [query.batchId];
      } else {
        allowedBatchIds = batchIds;
      }

      if (allowedBatchIds.length === 0) {
        return [];
      }
    } else if (query.batchId) {
      allowedBatchIds = [query.batchId];
    }

    let dbQuery = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        student_id,
        batch_id,
        teacher_id,
        date,
        status,
        created_at,
        marked_at,
        students (
          id,
          name,
          student_mobile
        ),
        batches (
          id,
          name,
          subject
        ),
        teachers (
          id,
          subject,
          profiles (
            full_name
          )
        )
      `)
      .order('date', { ascending: false });

    if (allowedBatchIds !== null) {
      dbQuery = dbQuery.in('batch_id', allowedBatchIds);
    }

    if (query.date) {
      dbQuery = dbQuery.eq('date', query.date);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('date', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('date', query.endDate);
    }

    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }

    const { data, error } = await dbQuery.limit(200);

    if (error) {
      throw new AppError(`Failed to fetch attendance history: ${error.message}`, 500);
    }

    return (data || []).map((r: any) => {
      const teacherProfile = Array.isArray(r.teachers?.profiles)
        ? r.teachers?.profiles[0]
        : r.teachers?.profiles;

      return {
        id: r.id,
        studentId: r.student_id,
        studentName: r.students?.name || 'Unknown Student',
        studentMobile: r.students?.student_mobile || '',
        batchId: r.batch_id,
        batchName: r.batches?.name || 'Unknown Batch',
        subject: r.batches?.subject || '',
        teacherId: r.teacher_id,
        teacherName: teacherProfile?.full_name || 'Assigned Instructor',
        attendanceDate: r.date,
        status: r.status,
        createdAt: r.created_at,
        markedAt: r.marked_at,
      };
    });
  }

  /**
   * Update a single attendance record (e.g. Admin or Teacher correction)
   */
  static async updateAttendanceRecord(
    id: string,
    dto: UpdateAttendanceDTO,
    requestingUser: AuthenticatedUser
  ) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('attendance')
      .select('id, batch_id, student_id, date, status')
      .eq('id', id)
      .single();

    if (fetchErr || !record) {
      throw new AppError('Attendance record not found', 404, 'NOT_FOUND');
    }

    // Role check for teachers: must be assigned to record's batch
    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        throw new AppError('Unauthorized access.', 403, 'FORBIDDEN');
      }

      const { data: assignment } = await supabaseAdmin
        .from('batch_teachers')
        .select('id')
        .eq('batch_id', record.batch_id)
        .eq('teacher_id', requestingUser.teacherId)
        .single();

      if (!assignment) {
        throw new AppError('You are not authorized to modify attendance for this unassigned batch.', 403, 'FORBIDDEN');
      }
    }

    // If no change in status, return immediately without duplicate updates or notifications
    if (record.status === dto.status) {
      return record;
    }

    const now = new Date().toISOString();
    const isCorrection = record.status === 'ABSENT' && dto.status === 'PRESENT';
    const updatePayload: any = {
      status: dto.status,
      marked_at: now,
    };

    const updateRes = await supabaseAdmin
      .from('attendance')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateRes.error || !updateRes.data) {
      throw new AppError(`Failed to update attendance: ${updateRes.error?.message}`, 500);
    }

    const updated = updateRes.data;

    // Trigger WhatsApp automations based on exact transition
    if (dto.status === 'ABSENT' && record.status !== 'ABSENT') {
      automationService
        .triggerAbsentAttendanceAutomation({
          studentId: record.student_id,
          batchId: record.batch_id,
          date: record.date,
        })
        .catch((e) => console.warn('[AttendanceService] Absent notification error:', e.message));
    } else if (isCorrection) {
      automationService
        .triggerAttendanceCorrectionAutomation({
          studentId: record.student_id,
          batchId: record.batch_id,
          date: record.date,
          correctedBy: requestingUser.profileId,
        })
        .catch((e) => console.warn('[AttendanceService] Attendance correction notification error:', e.message));
    }

    return updated;
  }
}
