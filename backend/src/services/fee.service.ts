import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  CreateFeePlanDTO,
  UpdateFeePlanDTO,
  AssignStudentFeeDTO,
  UpdateStudentFeeDTO,
  StudentFeeFilterQuery,
  StudentFeeStatus,
} from '../types/fee.types.js';
import { memoryCache } from '../utils/cache.js';

export class FeeService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  // ============================================================================
  // FEE PLANS
  // ============================================================================

  async createFeePlan(dto: CreateFeePlanDTO) {
    const { data, error } = await this.supabase
      .from('fee_plans')
      .insert({
        name: dto.name,
        amount: dto.amount,
        frequency: dto.frequency,
        due_day: dto.dueDay ?? null,
        active: dto.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[FeeService.createFeePlan] Error:', error);
      throw new AppError(`Failed to create fee plan: ${error.message}`, 500);
    }

    return data;
  }

  async listFeePlans(activeOnly = false) {
    let query = this.supabase
      .from('fee_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[FeeService.listFeePlans] Error:', error);
      throw new AppError(`Failed to fetch fee plans: ${error.message}`, 500);
    }

    return data || [];
  }

  async getFeePlanById(id: string) {
    const { data, error } = await this.supabase
      .from('fee_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Fee plan not found', 404, 'RESOURCE_NOT_FOUND');
    }

    return data;
  }

  async updateFeePlan(id: string, dto: UpdateFeePlanDTO) {
    // Verify existence
    await this.getFeePlanById(id);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.amount !== undefined) updatePayload.amount = dto.amount;
    if (dto.frequency !== undefined) updatePayload.frequency = dto.frequency;
    if (dto.dueDay !== undefined) updatePayload.due_day = dto.dueDay;
    if (dto.active !== undefined) updatePayload.active = dto.active;

    const { data, error } = await this.supabase
      .from('fee_plans')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[FeeService.updateFeePlan] Error:', error);
      throw new AppError(`Failed to update fee plan: ${error.message}`, 500);
    }

    return data;
  }

  async toggleFeePlanStatus(id: string, active: boolean) {
    return this.updateFeePlan(id, { active });
  }

  async deleteFeePlan(id: string) {
    await this.getFeePlanById(id);

    // Safely unlink from student_fees so historical payment and invoice records remain intact
    await this.supabase
      .from('student_fees')
      .update({ fee_plan_id: null })
      .eq('fee_plan_id', id);

    const { error } = await this.supabase
      .from('fee_plans')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[FeeService.deleteFeePlan] Error:', error);
      throw new AppError(`Failed to delete course: ${error.message}`, 500);
    }

    return {
      success: true,
      message: 'Course deleted successfully',
      id,
    };
  }

  // ============================================================================
  // STUDENT FEES
  // ============================================================================

  async assignStudentFee(dto: AssignStudentFeeDTO) {
    // 1. Verify student exists
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .select('id, name, status')
      .eq('id', dto.studentId)
      .single();

    if (studentError || !student) {
      throw new AppError('Student not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // 2. If feePlanId provided, verify it exists
    if (dto.feePlanId) {
      await this.getFeePlanById(dto.feePlanId);
    }

    // 3. Check if fee already assigned for this student & billing period
    const { data: existingFee } = await this.supabase
      .from('student_fees')
      .select('id')
      .eq('student_id', dto.studentId)
      .eq('billing_period', dto.billingPeriod)
      .maybeSingle();

    if (existingFee) {
      throw new AppError(
        `Fee already assigned for student for billing period ${dto.billingPeriod}`,
        400,
        'DUPLICATE_FEE_ASSIGNMENT'
      );
    }

    // 4. Calculate initial status based on business rules
    const amountPaid = dto.amountPaid || 0;
    const amountDue = dto.amountDue;
    const dueDateObj = new Date(dto.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let status: StudentFeeStatus = 'PENDING';
    if (amountPaid >= amountDue) {
      status = 'PAID';
    } else if (amountPaid > 0) {
      status = 'PARTIAL';
    } else if (dueDateObj < today) {
      status = 'OVERDUE';
    }

    // 5. Insert record
    const { data, error } = await this.supabase
      .from('student_fees')
      .insert({
        student_id: dto.studentId,
        fee_plan_id: dto.feePlanId ?? null,
        billing_period: dto.billingPeriod,
        amount_due: amountDue,
        amount_paid: amountPaid,
        due_date: dto.dueDate,
        status,
      })
      .select(`
        *,
        student:students(id, name, course, student_mobile),
        fee_plan:fee_plans(id, name, frequency)
      `)
      .single();

    if (error) {
      console.error('[FeeService.assignStudentFee] Error:', error);
      throw new AppError(`Failed to assign student fee: ${error.message}`, 500);
    }

    memoryCache.invalidateTag('dashboard');

    return {
      ...data,
      pending_amount: Math.max(0, Number(data.amount_due) - Number(data.amount_paid)),
    };
  }

  async listStudentFees(filters: StudentFeeFilterQuery = {}) {
    let query = this.supabase
      .from('student_fees')
      .select(`
        *,
        student:students(id, name, course, student_mobile, parent_name, parent_whatsapp),
        fee_plan:fee_plans(id, name, frequency)
      `)
      .order('due_date', { ascending: false });

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.billingPeriod) {
      query = query.eq('billing_period', filters.billingPeriod);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit && filters.limit > 0) {
      const page = filters.page && filters.page > 0 ? filters.page : 1;
      const from = (page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FeeService.listStudentFees] Error:', error);
      throw new AppError(`Failed to list student fees: ${error.message}`, 500);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatted = ((data || []) as Array<Record<string, any>>).map((item) => {
      const amountDue = Number(item.amount_due);
      const amountPaid = Number(item.amount_paid);
      const pendingAmount = Math.max(0, amountDue - amountPaid);

      // Dynamically evaluate overdue if status is PENDING and due date has passed
      let currentStatus = item.status as StudentFeeStatus;
      if (currentStatus === 'PENDING' && new Date(item.due_date) < today && pendingAmount > 0) {
        currentStatus = 'OVERDUE';
      }

      return {
        ...item,
        status: currentStatus,
        pending_amount: pendingAmount,
      };
    });

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return formatted.filter(
        (f: Record<string, any>) =>
          f.student?.name?.toLowerCase().includes(searchLower) ||
          f.billing_period?.toLowerCase().includes(searchLower) ||
          f.fee_plan?.name?.toLowerCase().includes(searchLower)
      );
    }

    return formatted;
  }

  async getStudentFeeById(id: string) {
    const { data, error } = await this.supabase
      .from('student_fees')
      .select(`
        *,
        student:students(id, name, course, student_mobile, parent_name, parent_whatsapp),
        fee_plan:fee_plans(id, name, frequency),
        payments:payments(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Student fee record not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const amountDue = Number(data.amount_due);
    const amountPaid = Number(data.amount_paid);

    return {
      ...data,
      pending_amount: Math.max(0, amountDue - amountPaid),
    };
  }

  async updateStudentFee(id: string, dto: UpdateStudentFeeDTO) {
    await this.getStudentFeeById(id);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.amountDue !== undefined) updatePayload.amount_due = dto.amountDue;
    if (dto.dueDate !== undefined) updatePayload.due_date = dto.dueDate;
    if (dto.status !== undefined) updatePayload.status = dto.status;

    const { data, error } = await this.supabase
      .from('student_fees')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        student:students(id, name, course, student_mobile),
        fee_plan:fee_plans(id, name, frequency)
      `)
      .single();

    if (error) {
      console.error('[FeeService.updateStudentFee] Error:', error);
      throw new AppError(`Failed to update student fee: ${error.message}`, 500);
    }

    memoryCache.invalidateTag('dashboard');

    return {
      ...data,
      pending_amount: Math.max(0, Number(data.amount_due) - Number(data.amount_paid)),
    };
  }

  /**
   * Automatically generate/sync monthly fee records for all active monthly students.
   * If October (or November/any month) starts, this ensures every active student gets their
   * billing record without manual entry. Active yearly students are protected and skipped.
   */
  async syncMonthlyFeesForAllStudents(targetPeriod?: string) {
    const now = new Date();
    const period = targetPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [periodYear, periodMonth] = period.split('-').map((v) => parseInt(v, 10));

    // 1. Fetch all active students with monthly fee > 0
    const { data: students, error: sErr } = await this.supabase
      .from('students')
      .select('id, name, monthly_fee, fee_due_day, admission_date, status')
      .eq('status', 'ACTIVE')
      .gt('monthly_fee', 0);

    if (sErr) throw new AppError(`Failed to fetch active students: ${sErr.message}`, 500);
    if (!students || students.length === 0) {
      return { syncedPeriod: period, createdCount: 0, totalActive: 0 };
    }

    // 2. Fetch existing fees for this billing period
    const { data: existingFees } = await this.supabase
      .from('student_fees')
      .select('student_id, billing_period')
      .eq('billing_period', period);

    const existingStudentIds = new Set((existingFees || []).map((f) => f.student_id));

    // 3. Fetch any active YEARLY fees
    const { data: yearlyFees } = await this.supabase
      .from('student_fees')
      .select('student_id, billing_period, due_date')
      .like('billing_period', '%_YEARLY%')
      .eq('status', 'PAID');

    const yearlyStudentIds = new Set((yearlyFees || []).map((yf) => yf.student_id));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newBillsToInsert: any[] = [];

    for (const student of students) {
      if (existingStudentIds.has(student.id) || yearlyStudentIds.has(student.id)) {
        continue;
      }

      // Check if admission date is strictly in a future month beyond period
      if (student.admission_date) {
        const admPeriod = student.admission_date.slice(0, 7);
        if (admPeriod > period) {
          continue; // Student hasn't joined yet in this period
        }
      }

      const dueDay = student.fee_due_day || 5;
      const dueDate = new Date(periodYear, periodMonth - 1, Math.min(dueDay, 28)).toISOString().split('T')[0];
      const isOverdue = new Date(dueDate) < today;

      newBillsToInsert.push({
        student_id: student.id,
        billing_period: period,
        amount_due: Number(student.monthly_fee),
        amount_paid: 0,
        due_date: dueDate,
        status: isOverdue ? 'OVERDUE' : 'PENDING',
      });
    }

    if (newBillsToInsert.length > 0) {
      const { error: insErr } = await this.supabase
        .from('student_fees')
        .insert(newBillsToInsert);

      if (insErr) {
        console.error('[FeeService.syncMonthlyFeesForAllStudents] Insert error:', insErr);
        throw new AppError(`Failed to insert monthly fees: ${insErr.message}`, 500);
      }
    }

    return {
      syncedPeriod: period,
      createdCount: newBillsToInsert.length,
      totalActive: students.length,
    };
  }
}

export const feeService = new FeeService();
