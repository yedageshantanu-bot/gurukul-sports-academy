import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { CreateBatchDTO, UpdateBatchDTO } from '../types/crm.types.js';
import { automationService } from './whatsapp/automation.service.js';

const isSchemaColumnError = (err: any) =>
  Boolean(
    err &&
      (err.code === '42703' ||
        err.code === 'PGRST204' ||
        err.message?.includes('schema cache') ||
        err.message?.includes('column'))
  );

export class BatchService {
  /**
   * List batches
   * Admin: all batches (with filters)
   * Teacher: ONLY batches assigned to them
   */
  static async listBatches(
    query: { search?: string; status?: string },
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

      const { data: assignments, error: aError } = await supabaseAdmin
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', requestingUser.teacherId);

      if (aError || !assignments || assignments.length === 0) {
        return [];
      }

      allowedBatchIds = assignments.map((a) => a.batch_id);
    }

    // Attempt with business fields (monthly_fee, description); fallback if column migration is pending
    const runBatchQuery = async (includeNewColumns: boolean) => {
      const selectFields = includeNewColumns
        ? `
          id,
          name,
          subject,
          description,
          monthly_fee,
          schedule_days,
          start_time,
          end_time,
          status,
          created_at,
          updated_at,
          batch_teachers (
            teacher_id,
            teachers (
              id,
              subject,
              profiles (
                full_name
              )
            )
          ),
          batch_students (
            student_id,
            status,
            students (
              monthly_fee
            )
          )
        `
        : `
          id,
          name,
          subject,
          schedule_days,
          start_time,
          end_time,
          status,
          created_at,
          updated_at,
          batch_teachers (
            teacher_id,
            teachers (
              id,
              subject,
              profiles (
                full_name
              )
            )
          ),
          batch_students (
            student_id,
            status,
            students (
              monthly_fee
            )
          )
        `;

      let q = supabaseAdmin!
        .from('batches')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (query.status && (query.status === STATUS.ACTIVE || query.status === STATUS.INACTIVE)) {
        q = q.eq('status', query.status);
      }

      if (allowedBatchIds !== null) {
        if (allowedBatchIds.length === 0) {
          return { data: [], error: null };
        }
        q = q.in('id', allowedBatchIds);
      }

      return await q;
    };

    let result = await runBatchQuery(true);
    if (result.error && isSchemaColumnError(result.error)) {
      // Column does not exist yet; run resilient fallback query
      result = await runBatchQuery(false);
    }

    if (result.error) {
      throw new AppError(`Failed to fetch batches: ${result.error.message}`, 500);
    }

    let batches = (result.data || []).map((b: any) => {
      const activeStudents = (b.batch_students || []).filter(
        (bs: any) => bs.status === STATUS.ACTIVE || !bs.status
      );
      const activeStudentsCount = activeStudents.length;

      // If batch.monthly_fee is present and > 0, use it; otherwise infer from enrolled students or 0
      let monthlyFee = Number(b.monthly_fee || 0);
      if (!monthlyFee && activeStudents.length > 0) {
        const studentFee = activeStudents.find((bs: any) => Number(bs.students?.monthly_fee) > 0);
        if (studentFee) {
          monthlyFee = Number(studentFee.students.monthly_fee);
        }
      }

      const teachers = (b.batch_teachers || [])
        .map((bt: any) => ({
          teacherId: bt.teacher_id,
          fullName: bt.teachers?.profiles?.full_name || 'Assigned Teacher',
          subject: bt.teachers?.subject || '',
        }))
        .filter((t: any) => t.teacherId);

      return {
        id: b.id,
        name: b.name,
        subject: b.subject || '',
        description: b.description || b.subject || '',
        monthlyFee,
        scheduleDays: b.schedule_days || [],
        startTime: b.start_time || '',
        endTime: b.end_time || '',
        status: b.status,
        studentCount: activeStudentsCount,
        teacherCount: teachers.length,
        assignedTeachers: teachers,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      };
    });

    if (query.search) {
      const s = query.search.toLowerCase();
      batches = batches.filter(
        (b) =>
          b.name.toLowerCase().includes(s) ||
          b.subject.toLowerCase().includes(s) ||
          b.description.toLowerCase().includes(s) ||
          b.assignedTeachers.some((t: any) => t.fullName.toLowerCase().includes(s))
      );
    }

    return batches;
  }

  /**
   * Get single batch with assigned teachers and enrolled students
   * Server-side authorization: Teacher can ONLY view assigned batch
   */
  static async getBatchById(id: string, requestingUser: AuthenticatedUser) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Role check for teacher
    if (requestingUser.role === ROLES.TEACHER) {
      if (!requestingUser.teacherId) {
        throw new AppError('You are not authorized to view this batch.', 403, 'FORBIDDEN');
      }

      const { data: assignment } = await supabaseAdmin
        .from('batch_teachers')
        .select('id')
        .eq('batch_id', id)
        .eq('teacher_id', requestingUser.teacherId)
        .single();

      if (!assignment) {
        throw new AppError('You are not authorized to view this unassigned batch.', 403, 'FORBIDDEN');
      }
    }

    const runSingleBatchQuery = async (includeNewColumns: boolean) => {
      const selectFields = includeNewColumns
        ? `
          id,
          name,
          subject,
          description,
          monthly_fee,
          schedule_days,
          start_time,
          end_time,
          status,
          created_at,
          updated_at,
          batch_teachers (
            teacher_id,
            assigned_at,
            teachers (
              id,
              subject,
              status,
              profiles (
                id,
                full_name,
                email,
                phone
              )
            )
          ),
          batch_students (
            student_id,
            joined_at,
            status,
            students (
              id,
              name,
              parent_name,
              student_mobile,
              parent_whatsapp,
              email,
              monthly_fee,
              status
            )
          )
        `
        : `
          id,
          name,
          subject,
          schedule_days,
          start_time,
          end_time,
          status,
          created_at,
          updated_at,
          batch_teachers (
            teacher_id,
            assigned_at,
            teachers (
              id,
              subject,
              status,
              profiles (
                id,
                full_name,
                email,
                phone
              )
            )
          ),
          batch_students (
            student_id,
            joined_at,
            status,
            students (
              id,
              name,
              parent_name,
              student_mobile,
              parent_whatsapp,
              email,
              monthly_fee,
              status
            )
          )
        `;

      return await supabaseAdmin!
        .from('batches')
        .select(selectFields)
        .eq('id', id)
        .single();
    };

    let result = await runSingleBatchQuery(true);
    if (result.error && isSchemaColumnError(result.error)) {
      result = await runSingleBatchQuery(false);
    }

    const batch: any = result.data;
    if (result.error || !batch) {
      throw new AppError('Batch not found', 404, 'NOT_FOUND');
    }

    const assignedTeachers = (batch.batch_teachers || [])
      .map((bt: any) => ({
        teacherId: bt.teacher_id,
        assignedAt: bt.assigned_at,
        subject: bt.teachers?.subject || '',
        fullName: bt.teachers?.profiles?.full_name || '',
        email: bt.teachers?.profiles?.email || '',
        phone: bt.teachers?.profiles?.phone || '',
        status: bt.teachers?.status || '',
      }))
      .filter((t: any) => t.teacherId);

    // Current month identifier in YYYY-MM
    const now = new Date();
    const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If Admin, query current month's fee status for enrolled students
    const studentFeeMap = new Map<string, { status: string; pendingAmount: number; amountDue: number; amountPaid: number }>();
    if (requestingUser.role === ROLES.ADMIN && batch.batch_students && batch.batch_students.length > 0) {
      const studentIds = batch.batch_students.map((bs: any) => bs.student_id).filter(Boolean);
      if (studentIds.length > 0) {
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
            amountDue,
            amountPaid,
          });
        });
      }
    }

    const enrolledStudents = (batch.batch_students || [])
      .map((bs: any) => {
        const feeInfo = studentFeeMap.get(bs.student_id);
        return {
          studentId: bs.student_id,
          joinedAt: bs.joined_at,
          enrollmentStatus: bs.status,
          name: bs.students?.name || '',
          parentName: bs.students?.parent_name || '',
          studentMobile: bs.students?.student_mobile || '',
          parentWhatsapp: bs.students?.parent_whatsapp || '',
          email: bs.students?.email || '',
          status: bs.students?.status || '',
          // Include fee status ONLY for Admin (Teachers never see fee data)
          currentMonthFeeStatus: requestingUser.role === ROLES.ADMIN ? (feeInfo?.status || 'NOT_ASSIGNED') : undefined,
          currentMonthPendingAmount: requestingUser.role === ROLES.ADMIN ? (feeInfo?.pendingAmount || 0) : undefined,
        };
      })
      .filter((s: any) => s.studentId);

    // Fallback monthly fee calculation if batch.monthly_fee is absent
    let monthlyFee = Number(batch.monthly_fee || 0);
    if (!monthlyFee && batch.batch_students && batch.batch_students.length > 0) {
      const studentWithFee = batch.batch_students.find((bs: any) => Number(bs.students?.monthly_fee) > 0);
      if (studentWithFee) {
        monthlyFee = Number(studentWithFee.students.monthly_fee);
      }
    }

    return {
      id: batch.id,
      name: batch.name,
      subject: batch.subject || '',
      description: batch.description || batch.subject || '',
      monthlyFee,
      scheduleDays: batch.schedule_days || [],
      startTime: batch.start_time || '',
      endTime: batch.end_time || '',
      status: batch.status,
      assignedTeachers,
      enrolledStudents,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    };
  }

  /**
   * Create a new batch (Admin only)
   */
  static async createBatch(dto: CreateBatchDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const description = dto.description || dto.subject || null;
    const monthlyFee = dto.monthlyFee !== undefined ? Number(dto.monthlyFee) : 0;

    const basePayload: any = {
      name: dto.name.trim(),
      subject: description,
      schedule_days: dto.scheduleDays || [],
      start_time: dto.startTime || null,
      end_time: dto.endTime || null,
      status: dto.status || STATUS.ACTIVE,
    };

    let batch: any = null;

    // Try inserting with business fields
    const { data: bData, error: bError } = await supabaseAdmin
      .from('batches')
      .insert({
        ...basePayload,
        description,
        monthly_fee: monthlyFee,
      })
      .select()
      .single();

    if (!bError && bData) {
      batch = bData;
    } else if (bError && isSchemaColumnError(bError)) {
      // Resilient fallback if columns do not exist yet
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('batches')
        .insert(basePayload)
        .select()
        .single();

      if (fallbackError || !fallbackData) {
        throw new AppError(`Failed to create batch: ${fallbackError?.message}`, 500);
      }
      batch = { ...fallbackData, description, monthly_fee: monthlyFee };
    } else {
      throw new AppError(`Failed to create batch: ${bError?.message}`, 500);
    }

    // If teacherIds provided, assign them
    if (dto.teacherIds && dto.teacherIds.length > 0) {
      const assignments = dto.teacherIds.map((tId) => ({
        batch_id: batch.id,
        teacher_id: tId,
      }));
      await supabaseAdmin.from('batch_teachers').insert(assignments);

      // Trigger WhatsApp notifications for assigned teachers
      for (const tId of dto.teacherIds) {
        try {
          const { data: teacher } = await supabaseAdmin
            .from('teachers')
            .select('id, profiles(full_name, phone)')
            .eq('id', tId)
            .single();
          if (teacher) {
            const prof = (Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles) as any;
            if (prof?.phone) {
              automationService
                .triggerBatchTeacherAssignedAutomation({
                  teacherPhone: prof.phone,
                  teacherName: prof.full_name || 'Instructor',
                  batchName: batch.name,
                  subject: batch.subject,
                  scheduleDays: batch.schedule_days,
                  startTime: batch.start_time,
                  endTime: batch.end_time,
                })
                .catch((err: any) => console.warn('[BatchService] Failed to dispatch teacher WhatsApp assignment:', err.message));
            }
          }
        } catch {}
      }
    }

    return {
      ...batch,
      monthlyFee: Number(batch.monthly_fee ?? monthlyFee),
      description: batch.description ?? description,
    };
  }

  /**
   * Update batch (Admin only)
   */
  static async updateBatch(id: string, dto: UpdateBatchDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (dto.name) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description || null;
    if (dto.description !== undefined || dto.subject !== undefined) {
      updates.subject = dto.description || dto.subject || null;
    }
    if (dto.monthlyFee !== undefined) updates.monthly_fee = Number(dto.monthlyFee);
    if (dto.scheduleDays !== undefined) updates.schedule_days = dto.scheduleDays;
    if (dto.startTime !== undefined) updates.start_time = dto.startTime || null;
    if (dto.endTime !== undefined) updates.end_time = dto.endTime || null;
    if (dto.status) updates.status = dto.status;

    let updated: any = null;
    const { data: uData, error: uError } = await supabaseAdmin
      .from('batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!uError && uData) {
      updated = uData;
    } else if (uError && isSchemaColumnError(uError)) {
      // Resilient fallback if monthly_fee or description columns do not exist
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.monthly_fee;
      delete fallbackUpdates.description;

      const { data: fData, error: fError } = await supabaseAdmin
        .from('batches')
        .update(fallbackUpdates)
        .eq('id', id)
        .select()
        .single();

      if (fError || !fData) {
        throw new AppError(`Failed to update batch: ${fError?.message || 'Not found'}`, fError ? 500 : 404);
      }
      updated = {
        ...fData,
        description: dto.description ?? fData.subject,
        monthly_fee: dto.monthlyFee ?? 0,
      };
    } else {
      throw new AppError(`Failed to update batch: ${uError?.message || 'Not found'}`, uError ? 500 : 404);
    }

    // If teacherIds provided, synchronize teacher assignments for this batch
    if (dto.teacherIds !== undefined) {
      const { data: currentRows } = await supabaseAdmin
        .from('batch_teachers')
        .select('teacher_id')
        .eq('batch_id', id);

      const currentIds: string[] = (currentRows || []).map((r: any) => r.teacher_id);
      const targetIds: string[] = dto.teacherIds || [];

      const toRemove = currentIds.filter((tId) => !targetIds.includes(tId));
      const toAdd = targetIds.filter((tId) => !currentIds.includes(tId));

      if (toRemove.length > 0) {
        await supabaseAdmin
          .from('batch_teachers')
          .delete()
          .eq('batch_id', id)
          .in('teacher_id', toRemove);
      }

      if (toAdd.length > 0) {
        const newRows = toAdd.map((tId) => ({
          batch_id: id,
          teacher_id: tId,
        }));
        await supabaseAdmin.from('batch_teachers').insert(newRows);

        // Notify newly assigned teachers via WhatsApp
        for (const tId of toAdd) {
          try {
            const { data: teacher } = await supabaseAdmin
              .from('teachers')
              .select('id, profiles(full_name, phone)')
              .eq('id', tId)
              .single();
            if (teacher) {
              const prof = (Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles) as any;
              if (prof?.phone) {
                automationService
                  .triggerBatchTeacherAssignedAutomation({
                    teacherPhone: prof.phone,
                    teacherName: prof.full_name || 'Instructor',
                    batchName: updated.name,
                    subject: updated.subject,
                    scheduleDays: updated.schedule_days,
                    startTime: updated.start_time,
                    endTime: updated.end_time,
                  })
                  .catch((err: any) => console.warn('[BatchService] Failed to dispatch teacher WhatsApp assignment:', err.message));
              }
            }
          } catch {}
        }
      }
    }

    return {
      ...updated,
      monthlyFee: Number(updated.monthly_fee ?? dto.monthlyFee ?? 0),
      description: updated.description ?? dto.description ?? updated.subject ?? '',
    };
  }

  /**
   * Toggle batch status
   */
  static async setBatchStatus(id: string, targetStatus: 'ACTIVE' | 'INACTIVE') {
    return this.updateBatch(id, { status: targetStatus });
  }

  /**
   * Assign teacher to batch (Admin only)
   */
  static async assignTeacher(batchId: string, teacherId: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Verify batch & teacher details for WhatsApp trigger
    const [batchRes, teacherRes] = await Promise.all([
      supabaseAdmin.from('batches').select('id, name, subject, schedule_days, start_time, end_time').eq('id', batchId).single(),
      supabaseAdmin.from('teachers').select('id, profiles(full_name, phone)').eq('id', teacherId).single(),
    ]);

    const batch = batchRes.data;
    const teacher = teacherRes.data;
    if (!batch) throw new AppError('Batch not found', 404);
    if (!teacher) throw new AppError('Teacher not found', 404);

    const { error } = await supabaseAdmin.from('batch_teachers').upsert(
      {
        batch_id: batchId,
        teacher_id: teacherId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'batch_id,teacher_id' }
    );

    if (error) {
      throw new AppError(`Failed to assign teacher to batch: ${error.message}`, 500);
    }

    // Dispatch WhatsApp notification to assigned teacher
    const teacherProfile = Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles;
    if (teacherProfile?.phone) {
      automationService.triggerBatchTeacherAssignedAutomation({
        teacherPhone: teacherProfile.phone,
        teacherName: teacherProfile.full_name || 'Instructor',
        batchName: batch.name,
        subject: batch.subject,
        scheduleDays: batch.schedule_days,
        startTime: batch.start_time,
        endTime: batch.end_time,
      }).catch((e) => console.warn('[BatchService] Teacher assignment alert warning:', e.message));
    }

    return { success: true, batchId, teacherId };
  }

  /**
   * Remove teacher from batch (Admin only)
   */
  static async removeTeacher(batchId: string, teacherId: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Fetch details for unassign notification
    const [batchRes, teacherRes] = await Promise.all([
      supabaseAdmin.from('batches').select('id, name').eq('id', batchId).single(),
      supabaseAdmin.from('teachers').select('id, profiles(full_name, phone)').eq('id', teacherId).single(),
    ]);

    const { error } = await supabaseAdmin
      .from('batch_teachers')
      .delete()
      .eq('batch_id', batchId)
      .eq('teacher_id', teacherId);

    if (error) {
      throw new AppError(`Failed to remove teacher from batch: ${error.message}`, 500);
    }

    const teacherProfile = Array.isArray(teacherRes.data?.profiles) ? teacherRes.data?.profiles[0] : teacherRes.data?.profiles;
    if (teacherProfile?.phone && batchRes.data?.name) {
      automationService.triggerBatchTeacherUnassignedAutomation({
        teacherPhone: teacherProfile.phone,
        teacherName: teacherProfile.full_name || 'Instructor',
        batchName: batchRes.data.name,
      }).catch((e) => console.warn('[BatchService] Teacher unassignment alert warning:', e.message));
    }

    return { success: true, batchId, teacherId };
  }

  /**
   * Assign student to batch (Admin only)
   */
  static async assignStudent(batchId: string, studentId: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Fetch batch and student details for enrollment alert
    const [batchRes, studentRes] = await Promise.all([
      supabaseAdmin.from('batches').select('id, name, subject, schedule_days, start_time, end_time').eq('id', batchId).single(),
      supabaseAdmin.from('students').select('id, name, parent_whatsapp, student_mobile').eq('id', studentId).single(),
    ]);

    const batch = batchRes.data;
    const student = studentRes.data;
    if (!batch) throw new AppError('Batch not found', 404);
    if (!student) throw new AppError('Student not found', 404);

    const { error } = await supabaseAdmin.from('batch_students').upsert(
      {
        batch_id: batchId,
        student_id: studentId,
        status: STATUS.ACTIVE,
      },
      { onConflict: 'batch_id,student_id' }
    );

    if (error) {
      throw new AppError(`Failed to assign student to batch: ${error.message}`, 500);
    }

    // Dispatch WhatsApp enrollment alert to parent
    const recipientPhone = student.parent_whatsapp || student.student_mobile;
    if (recipientPhone) {
      automationService.triggerBatchStudentEnrolledAutomation({
        parentPhone: recipientPhone,
        studentName: student.name,
        batchName: batch.name,
        subject: batch.subject,
        scheduleDays: batch.schedule_days,
        startTime: batch.start_time,
        endTime: batch.end_time,
      }).catch((e) => console.warn('[BatchService] Student enrollment alert warning:', e.message));
    }

    return { success: true, batchId, studentId };
  }

  /**
   * Remove student from batch (Admin only)
   */
  static async removeStudent(batchId: string, studentId: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const [batchRes, studentRes] = await Promise.all([
      supabaseAdmin.from('batches').select('id, name').eq('id', batchId).single(),
      supabaseAdmin.from('students').select('id, name, parent_whatsapp, student_mobile').eq('id', studentId).single(),
    ]);

    const { error } = await supabaseAdmin
      .from('batch_students')
      .delete()
      .eq('batch_id', batchId)
      .eq('student_id', studentId);

    if (error) {
      throw new AppError(`Failed to remove student from batch: ${error.message}`, 500);
    }

    const recipientPhone = studentRes.data?.parent_whatsapp || studentRes.data?.student_mobile;
    if (recipientPhone && batchRes.data?.name) {
      automationService.triggerBatchStudentUnassignedAutomation({
        parentPhone: recipientPhone,
        studentName: studentRes.data?.name || 'Student',
        batchName: batchRes.data.name,
      }).catch((e) => console.warn('[BatchService] Student unenrollment alert warning:', e.message));
    }

    return { success: true, batchId, studentId };
  }

  /**
   * Permanently delete a batch and cleanup relationships safely
   */
  static async deleteBatch(id: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // 1. Delete assignments
    await supabaseAdmin.from('batch_students').delete().eq('batch_id', id);
    await supabaseAdmin.from('batch_teachers').delete().eq('batch_id', id);

    // 2. Delete attendance records for this batch
    await supabaseAdmin.from('attendance').delete().eq('batch_id', id);

    // 3. Delete batch record
    const { error } = await supabaseAdmin.from('batches').delete().eq('id', id);
    if (error) {
      throw new AppError(`Failed to delete batch: ${error.message}`, 500);
    }

    return { id, success: true };
  }
}
