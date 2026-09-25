import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { queueService } from './whatsapp/queue.service.js';

export interface CreatePublicationStudentDTO {
  studentId?: string;
  student_id?: string;
  isExternal?: boolean;
  is_external?: boolean;
  studentName?: string;
  student_name?: string;
  parentName?: string;
  parent_name?: string;
  contactNumber?: string;
  contact_number?: string;
  email?: string;
  publicationTitle?: string;
  publication_title?: string;
  academicYear?: string;
  academic_year?: string;
  annualFee?: number;
  annual_fee?: number | string;
  amountPaid?: number;
  amount_paid?: number | string;
  feeStatus?: 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE';
  fee_status?: 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE';
  renewalDueDate?: string;
  renewal_due_date?: string;
  deliveryStatus?: 'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING';
  delivery_status?: 'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING';
  paymentMethod?: string;
  payment_method?: string;
  notes?: string;
}

export class PublicationService {
  /**
   * List all published document students with optional filters
   */
  static async listPublicationStudents(filters: {
    search?: string;
    feeStatus?: string;
    deliveryStatus?: string;
    academicYear?: string;
    isExternal?: boolean;
  } = {}) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    let query = supabaseAdmin
      .from('publication_students')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.feeStatus) {
      query = query.eq('fee_status', filters.feeStatus);
    }
    if (filters.deliveryStatus) {
      query = query.eq('delivery_status', filters.deliveryStatus);
    }
    if (filters.academicYear) {
      query = query.eq('academic_year', filters.academicYear);
    }
    if (filters.isExternal !== undefined) {
      query = query.eq('is_external', filters.isExternal);
    }
    if (filters.search) {
      query = query.or(`student_name.ilike.%${filters.search}%,contact_number.ilike.%${filters.search}%,parent_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Failed to fetch publication students: ${error.message}`, 500);
    }

    // Calculate publication finance summary
    let totalAnnualExpected = 0;
    let totalCollected = 0;
    let totalPending = 0;
    (data || []).forEach((row: any) => {
      const due = Number(row.annual_fee || 0);
      const paid = Number(row.amount_paid || 0);
      totalAnnualExpected += due;
      totalCollected += paid;
      totalPending += Math.max(0, due - paid);
    });

    return {
      summary: {
        totalStudents: data?.length || 0,
        totalAnnualExpected,
        totalCollected,
        totalPending,
        dispatchedCount: (data || []).filter((r: any) => r.delivery_status === 'DISPATCHED' || r.delivery_status === 'HANDED_OVER').length,
      },
      students: data || [],
    };
  }

  /**
   * Register a new publication student (external or existing academy student)
   */
  static async createPublicationStudent(dto: CreatePublicationStudentDTO) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const studentId = dto.studentId || dto.student_id;
    let studentName = dto.studentName || dto.student_name;
    let parentName = dto.parentName || dto.parent_name || '';
    let contactNumber = dto.contactNumber || dto.contact_number;
    let email = dto.email || '';

    // If linked to existing academy student, auto-fill profile details if blank
    if (studentId) {
      const { data: existingStudent } = await supabaseAdmin
        .from('students')
        .select('name, parent_name, parent_whatsapp, student_mobile, email')
        .eq('id', studentId)
        .single();

      if (existingStudent) {
        studentName = studentName || existingStudent.name;
        parentName = parentName || existingStudent.parent_name || '';
        contactNumber = contactNumber || existingStudent.parent_whatsapp || existingStudent.student_mobile || '';
        email = email || existingStudent.email || '';
      }
    }

    if (!studentName || !contactNumber) {
      throw new AppError('Student name and contact number are required', 400);
    }

    const rawAnnualFee = dto.annualFee !== undefined ? dto.annualFee : dto.annual_fee;
    const annualFee = rawAnnualFee !== undefined ? Number(rawAnnualFee) : 2500;
    const rawPaid = dto.amountPaid !== undefined ? dto.amountPaid : dto.amount_paid;
    const amountPaid = rawPaid !== undefined ? Number(rawPaid) : 0;
    let feeStatus = dto.feeStatus || dto.fee_status;
    if (!feeStatus) {
      if (amountPaid >= annualFee && annualFee > 0) feeStatus = 'PAID';
      else if (amountPaid > 0) feeStatus = 'PARTIAL';
      else feeStatus = 'PENDING';
    }

    const renewalDueDate = dto.renewalDueDate || dto.renewal_due_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isExternal = dto.isExternal !== undefined ? dto.isExternal : (dto.is_external !== undefined ? dto.is_external : (studentId ? false : true));

    const { data, error } = await supabaseAdmin
      .from('publication_students')
      .insert({
        student_id: studentId || null,
        is_external: isExternal,
        student_name: studentName,
        parent_name: parentName,
        contact_number: contactNumber,
        email: email || null,
        publication_title: dto.publicationTitle || dto.publication_title || 'Gurukul Martial Arts & Sports Annual Manual - Vol 2026',
        academic_year: dto.academicYear || dto.academic_year || '2026-2027',
        annual_fee: annualFee,
        amount_paid: amountPaid,
        fee_status: feeStatus,
        renewal_due_date: renewalDueDate,
        delivery_status: dto.deliveryStatus || dto.delivery_status || 'PENDING',
        payment_method: dto.paymentMethod || dto.payment_method || null,
        notes: dto.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to add publication student: ${error.message}`, 500);
    }

    return data;
  }

  /**
   * Update student publication record or delivery status
   */
  static async updatePublicationStudent(id: string, updates: Partial<CreatePublicationStudentDTO>) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.studentName !== undefined) payload.student_name = updates.studentName;
    if (updates.parentName !== undefined) payload.parent_name = updates.parentName;
    if (updates.contactNumber !== undefined) payload.contact_number = updates.contactNumber;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.publicationTitle !== undefined) payload.publication_title = updates.publicationTitle;
    if (updates.academicYear !== undefined) payload.academic_year = updates.academicYear;
    if (updates.annualFee !== undefined) payload.annual_fee = updates.annualFee;
    if (updates.amountPaid !== undefined) payload.amount_paid = updates.amountPaid;
    if (updates.feeStatus !== undefined) payload.fee_status = updates.feeStatus;
    if (updates.deliveryStatus !== undefined) payload.delivery_status = updates.deliveryStatus;
    if (updates.renewalDueDate !== undefined) payload.renewal_due_date = updates.renewalDueDate;
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabaseAdmin
      .from('publication_students')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to update publication student: ${error.message}`, 500);
    }

    return data;
  }

  /**
   * Record fee payment for publication student
   */
  static async recordPublicationFee(id: string, amount: number, paymentMethod: string = 'UPI', notes?: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('publication_students')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !record) throw new AppError('Publication student record not found', 404);

    const newAmountPaid = Number(record.amount_paid || 0) + Number(amount);
    const annualFee = Number(record.annual_fee || 0);
    const feeStatus = newAmountPaid >= annualFee ? 'PAID' : (newAmountPaid > 0 ? 'PARTIAL' : 'PENDING');

    const { data, error } = await supabaseAdmin
      .from('publication_students')
      .update({
        amount_paid: newAmountPaid,
        fee_status: feeStatus,
        payment_method: paymentMethod,
        notes: notes ? `${record.notes ? record.notes + '; ' : ''}${notes}` : record.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(`Failed to record publication payment: ${error.message}`, 500);

    return data;
  }

  /**
   * Dispatch annual fee WhatsApp reminder to publication student / parent
   */
  static async sendRenewalReminder(id: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('publication_students')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !record) throw new AppError('Publication student not found', 404);

    const pendingAmount = Math.max(0, Number(record.annual_fee) - Number(record.amount_paid));
    const parent = record.parent_name || 'Parent/Guardian';
    const student = record.student_name;
    const title = record.publication_title;
    const dueDate = record.renewal_due_date || 'soon';

    const message = `📚 *Gurukul Publication Annual Renewal Notice*\n\nDear ${parent},\n\nThe annual document/curriculum publication fee for *${student}* for *${title}* is pending renewal.\n\n• Annual Fee Due: *₹${pendingAmount.toLocaleString('en-IN')}*\n• Renewal Due Date: *${dueDate}*\n\nKindly confirm payment to ensure continuous edition dispatch.\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;

    try {
      await queueService.enqueueMessage({
        recipientPhone: record.contact_number,
        messageBody: message,
        studentId: record.student_id,
        eventType: 'PUBLICATION_FEE_REMINDER',
        idempotencyKey: `PUB_REMIND:${record.id}:${new Date().toISOString().split('T')[0]}`,
      });
      return { success: true, message: 'WhatsApp publication renewal reminder dispatched.' };
    } catch (err: any) {
      console.warn('[PublicationService.sendRenewalReminder] WhatsApp dispatch failed:', err.message);
      return { success: true, message: 'Message logged (gateway pending).' };
    }
  }
}
