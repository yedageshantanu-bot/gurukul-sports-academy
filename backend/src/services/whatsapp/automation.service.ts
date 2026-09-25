import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { env } from '../../config/env.js';
import { requestContext } from '../../config/requestContext.js';
import { ROLES } from '../../constants/index.js';
import { templateService } from './template.service.js';
import { queueService } from './queue.service.js';
import {
  SendCustomMessageDTO,
  MessageFilterQuery,
  WhatsAppEventType,
} from '../../types/whatsapp.types.js';
import { PdfReportService, StudentReportData } from '../pdfReport.service.js';
import { prototypeLinkedDeviceSender } from './prototypeLinkedDeviceSender.js';
import { normalizePhoneNumber } from '../../utils/phone.js';

export class WhatsAppAutomationService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  async getAcademyName(): Promise<string> {
    try {
      const { data } = await this.supabase
        .from('academy_settings')
        .select('academy_name')
        .limit(1)
        .maybeSingle();
      if (data?.academy_name) {
        return data.academy_name;
      }
    } catch {
      // fallback
    }
    const isDemo =
      env.DEMO_MODE ||
      env.APP_ENV === 'demo' ||
      requestContext.getStore()?.user?.role === ROLES.DEMO_ADMIN ||
      requestContext.getStore()?.user?.isTrial;
    return isDemo ? 'Effort Career Classes' : 'Gurukul Sports Academy';
  }

  // ============================================================================
  // TEMPLATE RENDERING (Supports all CRM & Razorpay Variables)
  // ============================================================================
  renderTemplate(templateBody: string, variables: Record<string, string>): string {
    let rendered = templateBody;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value !== undefined && value !== null ? String(value) : '');
    }
    return rendered;
  }

  /**
   * Checks whether this phone number has ever received a message from our academy before.
   */
  async hasReceivedPriorMessages(phone: string): Promise<boolean> {
    try {
      const normalized = phone.replace(/[^\d+]/g, '');
      const { count, error } = await this.supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_phone', normalized);

      if (!error && count && count > 0) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Intelligently formats message:
   * - If FIRST EVER message to this parent: appends one-time contact save guidance.
   * - If RETURNING parent: keeps message 100% clean and concise without repetitive notes!
   */
  async formatMessageWithOnboardingNote(baseBody: string, phone: string, academyName: string): Promise<string> {
    const isReturning = await this.hasReceivedPriorMessages(phone);
    if (!isReturning) {
      return `${baseBody}\n\n📌 _टीप: कृपया भविष्यातील सूचनांसाठी हा अधिकृत ${academyName} चा नंबर सेव्ह करून ठेवावा._`;
    }
    return baseBody;
  }

  // ============================================================================
  // AUTOMATION: ATTENDANCE ABSENT
  // ============================================================================
  async triggerAbsentAttendanceAutomation(params: {
    studentId: string;
    batchId: string;
    date: string;
  }) {
    try {
      // 1. Get active template
      const template = await templateService.getActiveTemplateForEvent('ATTENDANCE_ABSENT');
      if (!template) {
        console.log('[WhatsAppAutomation] No active template for ATTENDANCE_ABSENT. Skipping.');
        return null;
      }

      // 2. Fetch student and batch details
      const [studentRes, batchRes] = await Promise.all([
        this.supabase
          .from('students')
          .select('id, name, parent_name, parent_whatsapp, student_mobile, course')
          .eq('id', params.studentId)
          .single(),
        this.supabase
          .from('batches')
          .select('id, name')
          .eq('id', params.batchId)
          .single(),
      ]);

      if (studentRes.error || !studentRes.data) return null;
      const student = studentRes.data;
      const batchName = batchRes.data?.name || 'Class';

      const recipientPhone = student.parent_whatsapp || student.student_mobile;
      if (!recipientPhone) {
        console.log(`[WhatsAppAutomation] Student ${student.name} has no phone number on file. Skipping.`);
        return null;
      }

      // 3. Render variables
      const academyName = await this.getAcademyName();
      const baseBody = this.renderTemplate(template.body, {
        academy_name: academyName,
        student_name: student.name,
        parent_name: student.parent_name || 'Parent',
        phone: recipientPhone,
        course_name: student.course || 'Course',
        batch_name: batchName,
        date: params.date,
      });

      const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, academyName);

      // 4. Enqueue into transactional queue with transition idempotency key
      const idempotencyKey = `ATTENDANCE_ABSENT:${student.id}:${params.date}:${Date.now()}`;
      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        studentId: student.id,
        templateId: template.id,
        eventType: 'ATTENDANCE_ABSENT',
        idempotencyKey,
      });

      // 5. Process through safety checks immediately
      await queueService.processItem(queued);

      return queued;
    } catch (err: any) {
      // Non-blocking error boundary
      console.warn('[WhatsAppAutomation.triggerAbsentAttendanceAutomation] Handled warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // AUTOMATION: ATTENDANCE CORRECTION (ABSENT -> PRESENT)
  // ============================================================================
  async triggerAttendanceCorrectionAutomation(params: {
    studentId: string;
    batchId: string;
    date: string;
    correctedBy?: string;
  }) {
    try {
      // 1. Get active template
      const template = await templateService.getActiveTemplateForEvent('ATTENDANCE_CORRECTION');
      if (!template) {
        console.log('[WhatsAppAutomation] No active template for ATTENDANCE_CORRECTION. Skipping.');
        return null;
      }

      // 2. Only send correction if an ABSENT alert was previously queued or logged for this student and date
      const absentIdempotencyKey = `ATTENDANCE_ABSENT:${params.studentId}:${params.date}`;
      const [queueAbsentCheck, messageAbsentCheck] = await Promise.all([
        this.supabase
          .from('whatsapp_queue')
          .select('id')
          .eq('idempotency_key', absentIdempotencyKey)
          .maybeSingle(),
        this.supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('student_id', params.studentId)
          .eq('event_type', 'ATTENDANCE_ABSENT')
          .gte('created_at', `${params.date}T00:00:00Z`)
          .lte('created_at', `${params.date}T23:59:59Z`)
          .maybeSingle(),
      ]);

      const wasAbsentNotified = !!(queueAbsentCheck.data || messageAbsentCheck.data);
      if (!wasAbsentNotified) {
        console.log(
          `[WhatsAppAutomation] Student ${params.studentId} was not notified ABSENT for ${params.date}. Skipping correction alert.`
        );
        return null;
      }

      // 3. Fetch student and batch details
      const [studentRes, batchRes] = await Promise.all([
        this.supabase
          .from('students')
          .select('id, name, parent_name, parent_whatsapp, student_mobile, course')
          .eq('id', params.studentId)
          .single(),
        this.supabase
          .from('batches')
          .select('id, name')
          .eq('id', params.batchId)
          .single(),
      ]);

      if (studentRes.error || !studentRes.data) return null;
      const student = studentRes.data;
      const batchName = batchRes.data?.name || 'Class';

      const recipientPhone = student.parent_whatsapp || student.student_mobile;
      if (!recipientPhone) return null;

      // 4. Render variables
      const academyName = await this.getAcademyName();
      const messageBody = this.renderTemplate(template.body, {
        academy_name: academyName,
        student_name: student.name,
        parent_name: student.parent_name || 'Parent',
        phone: recipientPhone,
        course_name: student.course || 'Course',
        batch_name: batchName,
        date: params.date,
      });

      // 5. Enqueue with strict idempotency key: one correction per student per date
      const correctionIdempotencyKey = `ATTENDANCE_CORRECTION:${params.studentId}:${params.date}`;
      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        studentId: student.id,
        templateId: template.id,
        eventType: 'ATTENDANCE_CORRECTION',
        idempotencyKey: correctionIdempotencyKey,
        metadata: {
          correctedBy: params.correctedBy,
          correctedAt: new Date().toISOString(),
          batchId: params.batchId,
          date: params.date,
        },
      });

      // 6. Process through safety checks immediately
      await queueService.processItem(queued);

      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerAttendanceCorrectionAutomation] Handled warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // AUTOMATION: PAYMENT SUCCESS
  // ============================================================================
  async triggerPaymentSuccessAutomation(params: {
    studentId: string;
    amount: number;
    receiptNumber?: string;
    studentFeeId?: string;
  }) {
    try {
      const template = await templateService.getActiveTemplateForEvent('PAYMENT_SUCCESS');
      if (!template) {
        console.log('[WhatsAppAutomation] No active template for PAYMENT_SUCCESS. Skipping.');
        return null;
      }

      const { data: student, error } = await this.supabase
        .from('students')
        .select('id, name, parent_name, parent_whatsapp, student_mobile, course')
        .eq('id', params.studentId)
        .single();

      if (error || !student) return null;

      const recipientPhone = student.parent_whatsapp || student.student_mobile;
      if (!recipientPhone) return null;

      const academyName = await this.getAcademyName();
      const messageBody = this.renderTemplate(template.body, {
        academy_name: academyName,
        student_name: student.name,
        parent_name: student.parent_name || 'Parent',
        phone: recipientPhone,
        course_name: student.course || 'Course',
        amount: params.amount.toString(),
        pending_amount: '0.00',
        receipt_number: params.receiptNumber || 'REC-CONFIRMED',
        date: new Date().toISOString().split('T')[0],
      });

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        studentId: student.id,
        templateId: template.id,
        eventType: 'PAYMENT_SUCCESS',
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerPaymentSuccessAutomation] Handled warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // AUTOMATION: FEE DUE / OVERDUE REMINDER
  // ============================================================================
  async triggerFeeReminderAutomation(params: {
    studentId: string;
    studentFeeId: string;
    eventType?: 'FEE_DUE' | 'FEE_OVERDUE' | 'FEE_UPCOMING';
  }) {
    const eventType: WhatsAppEventType = (params.eventType as WhatsAppEventType) || 'FEE_DUE';

    const template = await templateService.getActiveTemplateForEvent(eventType);
    if (!template) {
      throw new AppError(`No active template found for ${eventType}`, 400, 'TEMPLATE_NOT_FOUND');
    }

    const [studentRes, feeRes] = await Promise.all([
      this.supabase
        .from('students')
        .select('id, name, parent_name, parent_whatsapp, student_mobile, course')
        .eq('id', params.studentId)
        .single(),
      this.supabase
        .from('student_fees')
        .select('id, amount_due, amount_paid, due_date, billing_period')
        .eq('id', params.studentFeeId)
        .single(),
    ]);

    if (studentRes.error || !studentRes.data) {
      throw new AppError('Student not found', 404, 'RESOURCE_NOT_FOUND');
    }
    if (feeRes.error || !feeRes.data) {
      throw new AppError('Student fee record not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const student = studentRes.data;
    const fee = feeRes.data;
    const pendingAmount = Math.max(0, Number(fee.amount_due) - Number(fee.amount_paid));

    const recipientPhone = student.parent_whatsapp || student.student_mobile;
    if (!recipientPhone) {
      throw new AppError('Student has no WhatsApp/mobile number on record', 400, 'PHONE_NOT_FOUND');
    }

    // 5-Day Overdue Cutoff Protection: Stop automatic spam if overdue for > 5 days
    if (fee.due_date) {
      const dueDateMs = new Date(fee.due_date).getTime();
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 5) {
        console.warn(`[WhatsAppAutomation] Fee for student ${student.name} is overdue by ${daysOverdue} days. Automated reminders halted; escalated to Admin.`);
        return {
          id: `escalated_${fee.id}`,
          template_id: template.id,
          student_id: student.id,
          recipient_phone: recipientPhone,
          event_type: 'FEE_OVERDUE',
          message_body: `Automated WhatsApp reminders halted (> 5 days overdue). Escalated to Admin Dashboard.`,
          status: 'ESCALATED_TO_ADMIN',
          error_message: `Overdue cutoff reached (${daysOverdue} days overdue). Handled via Admin priority alert.`,
          sent_at: null,
          created_at: new Date().toISOString(),
        };
      }
    }

    // Razorpay payment link placeholder (clean demo link as requested)
    const razorpayPaymentLink = `https://pay.apexacademy.in/invoice/${fee.id.substring(0, 8)}`;
    console.log(`[WhatsAppAutomation] Generating fee reminder for student ${student.name} (Rs. ${pendingAmount}) with payment link: ${razorpayPaymentLink}`);

    const academyName = await this.getAcademyName();
    const baseBody = this.renderTemplate(template.body, {
      academy_name: academyName,
      student_name: student.name,
      parent_name: student.parent_name || 'Parent',
      phone: recipientPhone,
      course_name: student.course || 'Course',
      amount: pendingAmount.toString(),
      pending_amount: pendingAmount.toString(),
      due_date: fee.due_date,
      payment_link: razorpayPaymentLink,
      razorpay_payment_link: razorpayPaymentLink,
      date: new Date().toISOString().split('T')[0],
    });

    const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, academyName);

    const queued = await queueService.enqueueMessage({
      recipientPhone,
      messageBody,
      studentId: student.id,
      templateId: template.id,
      eventType,
    });

    const processResult = await queueService.processItem(queued);

    return {
      id: queued.id,
      template_id: queued.template_id,
      student_id: queued.student_id,
      recipient_phone: queued.recipient_phone,
      event_type: queued.event_type,
      message_body: queued.message_body,
      provider_message_id: queued.provider_message_id,
      status: processResult.status || queued.status,
      error_message: processResult.reason || queued.failure_reason,
      sent_at: processResult.status === 'SENT' ? new Date().toISOString() : queued.sent_at,
      created_at: queued.created_at,
    };
  }

  // ============================================================================
  // AUTOMATION: MONTHLY 5TH FEE DUE AUTOMATION (Staggered with 15s gap)
  // ============================================================================
  async triggerMonthly5thFeeDueAutomation() {
    try {
      const template = await templateService.getActiveTemplateForEvent('FEE_DUE');
      if (!template) {
        console.warn('[WhatsAppAutomation] No active template for FEE_DUE. Skipping monthly automation.');
        return { queuedCount: 0, escalatedCount: 0 };
      }

      // Fetch all students with unpaid fees
      const { data: unpaidFees, error } = await this.supabase
        .from('student_fees')
        .select(`
          id,
          amount_due,
          amount_paid,
          due_date,
          student:students (id, name, parent_name, parent_whatsapp, student_mobile, course)
        `)
        .gt('amount_due', 0);

      if (error || !unpaidFees) {
        console.error('[WhatsAppAutomation] Failed to fetch unpaid fees:', error?.message);
        return { queuedCount: 0, escalatedCount: 0 };
      }

      const eligibleItems: any[] = [];
      let escalatedCount = 0;
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const academyName = await this.getAcademyName();

      for (const fee of unpaidFees) {
        const student = Array.isArray(fee.student) ? fee.student[0] : fee.student;
        if (!student) continue;

        const pendingAmount = Math.max(0, Number(fee.amount_due) - Number(fee.amount_paid));
        if (pendingAmount <= 0) continue;

        const recipientPhone = student.parent_whatsapp || student.student_mobile;
        if (!recipientPhone) continue;

        // Check 5-day overdue cutoff rule
        if (fee.due_date) {
          const dueDateMs = new Date(fee.due_date).getTime();
          const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 5) {
            escalatedCount++;
            continue;
          }
        }

        const razorpayPaymentLink = `https://pay.apexacademy.in/invoice/${fee.id.substring(0, 8)}`;
        const messageBody = this.renderTemplate(template.body, {
          academy_name: academyName,
          student_name: student.name,
          parent_name: student.parent_name || 'Parent',
          phone: recipientPhone,
          course_name: student.course || 'Course',
          amount: pendingAmount.toString(),
          pending_amount: pendingAmount.toString(),
          due_date: fee.due_date,
          payment_link: razorpayPaymentLink,
          razorpay_payment_link: razorpayPaymentLink,
          date: new Date().toISOString().split('T')[0],
        });

        eligibleItems.push({
          recipientPhone,
          messageBody,
          studentId: student.id,
          templateId: template.id,
          eventType: 'FEE_DUE',
        });
      }

      // Enqueue with 15-second anti-ban throttle
      const queuedItems = await queueService.enqueueBatchStaggered(eligibleItems, 15000);
      return {
        queuedCount: queuedItems.length,
        escalatedCount,
        estimatedMinutes: Math.round((queuedItems.length * 15) / 60),
      };
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerMonthly5thFeeDueAutomation] Error:', err.message);
      return { queuedCount: 0, escalatedCount: 0, error: err.message };
    }
  }

  // ============================================================================
  // AUTOMATION: TEACHER WELCOME CREDENTIALS
  // ============================================================================
  async triggerTeacherWelcomeAutomation(params: {
    fullName: string;
    email: string;
    password?: string;
    phone: string;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.phone);
      if (!recipientPhone) {
        console.warn('[WhatsAppAutomation] Invalid teacher phone number for welcome message:', params.phone);
        return null;
      }

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const loginUrl = `${appUrl}/login`;
      const academyName = await this.getAcademyName();

      const messageBody = [
        `*Welcome to ${academyName}!* 🎓`,
        ``,
        `Hello *${params.fullName}*,`,
        `Your teacher instructor account has been created successfully. Here are your login credentials:`,
        ``,
        `🔗 *Portal Login:* ${loginUrl}`,
        `📧 *Email:* ${params.email}`,
        params.password ? `🔑 *Password:* ${params.password}` : '',
        ``,
        `Please log in to access your assigned batches and mark attendance.`,
        ``,
        `_Best regards,_`,
        `*${academyName} Administration*`,
      ]
        .filter(Boolean)
        .join('\n');

      console.log(`[WhatsAppAutomation] Enqueueing teacher welcome notification for ${recipientPhone} (${params.fullName})`);

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'TEACHER_CREDENTIALS',
        metadata: {
          teacherName: params.fullName,
          teacherEmail: params.email,
          createdAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerTeacherWelcomeAutomation] Handled warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // MANUAL CUSTOM DISPATCH
  // ============================================================================
  async sendCustomMessage(dto: SendCustomMessageDTO) {
    const queued = await queueService.enqueueMessage({
      recipientPhone: dto.recipientPhone,
      messageBody: dto.messageBody,
      studentId: dto.studentId,
      templateId: dto.templateId,
      eventType: dto.eventType || 'CUSTOM_NOTIFICATION',
      scheduledAt: dto.scheduledAt,
    });

    const processResult = await queueService.processItem(queued);

    const messageObj = {
      id: queued.id,
      template_id: queued.template_id,
      student_id: queued.student_id,
      recipient_phone: queued.recipient_phone,
      event_type: queued.event_type,
      message_body: queued.message_body,
      provider_message_id: queued.provider_message_id,
      status: queued.status,
      error_message: queued.failure_reason,
      sent_at: queued.sent_at,
      created_at: queued.created_at,
    };

    return {
      message: messageObj,
      result: (processResult as any).result || {
        success: processResult.success,
        provider: 'MOCK',
        messageId: queued.provider_message_id || queued.id,
        status: queued.status,
        errorMessage: processResult.reason,
      },
    };
  }

  // ============================================================================
  // AUTOMATION: BATCH TEACHER ASSIGNMENT & UNASSIGNMENT
  // ============================================================================
  async triggerBatchTeacherAssignedAutomation(params: {
    teacherPhone: string;
    teacherName: string;
    batchName: string;
    subject?: string;
    scheduleDays?: string[];
    startTime?: string;
    endTime?: string;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.teacherPhone);
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const scheduleInfo = params.scheduleDays?.length ? `Schedule: ${params.scheduleDays.join(', ')}` : '';
      const timeInfo = params.startTime && params.endTime ? `Time: ${params.startTime} - ${params.endTime}` : '';
      const academyName = await this.getAcademyName();

      const messageBody = `*Batch Assigned: ${academyName}*\n\nHello ${params.teacherName},\nYou have been assigned as the instructor for:\n*Batch:* ${params.batchName} (${params.subject || 'Academic'})\n${scheduleInfo}\n${timeInfo}\n\nPlease log in to your portal (${appUrl}/login) to view your enrolled students and record attendance.\n\n- ${academyName} Administration`;

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'TEACHER_BATCH_ASSIGNED',
        metadata: {
          batchName: params.batchName,
          assignedAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerBatchTeacherAssignedAutomation] Warning:', err.message);
      return null;
    }
  }

  async triggerBatchTeacherUnassignedAutomation(params: {
    teacherPhone: string;
    teacherName: string;
    batchName: string;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.teacherPhone);
      const academyName = await this.getAcademyName();
      const messageBody = `*Notice: Batch Unassigned - ${academyName}*\n\nHello ${params.teacherName},\nYou have been unassigned from batch *${params.batchName}*.\n\nThank you for your instruction and support.\n- ${academyName} Administration`;

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'TEACHER_BATCH_UNASSIGNED',
        metadata: {
          batchName: params.batchName,
          unassignedAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerBatchTeacherUnassignedAutomation] Warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // AUTOMATION: BATCH STUDENT ENROLLMENT & UNENROLLMENT
  // ============================================================================
  async triggerBatchStudentEnrolledAutomation(params: {
    parentPhone: string;
    studentName: string;
    batchName: string;
    subject?: string;
    scheduleDays?: string[];
    startTime?: string;
    endTime?: string;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.parentPhone);
      const scheduleInfo = params.scheduleDays?.length ? `सराव दिवस: ${params.scheduleDays.join(', ')}` : '';
      const timeInfo = params.startTime && params.endTime ? `वेळ: ${params.startTime} - ${params.endTime}` : '';
      const academyName = await this.getAcademyName();

      const baseBody = `*सराव तुकडी (Batch) प्रवेश निश्चित*\n\nनमस्कार पालकमित्र,\n*${params.studentName}* चा खालील सराव तुकडीमध्ये यशस्वीरीत्या प्रवेश झाला आहे:\n*तुकडी (Batch):* ${params.batchName} (${params.subject || 'क्रीडा सराव'})\n${scheduleInfo}\n${timeInfo}\n\nआपल्या पाल्याच्या क्रीडा प्रवासासाठी मनःपूर्वक शुभेच्छा!\n- ${academyName}`;
      const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, academyName);

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'STUDENT_BATCH_ENROLLED',
        metadata: {
          studentName: params.studentName,
          batchName: params.batchName,
          enrolledAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerBatchStudentEnrolledAutomation] Warning:', err.message);
      return null;
    }
  }

  async triggerBatchStudentUnassignedAutomation(params: {
    parentPhone: string;
    studentName: string;
    batchName: string;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.parentPhone);
      const academyName = await this.getAcademyName();
      const messageBody = `*सूचना: ${academyName}*\n\nनमस्कार पालकमित्र,\n*${params.studentName}* ला *${params.batchName}* या सराव तुकडीतून काढण्यात आले आहे.\n\nकाही अडचण किंवा चौकशी असल्यास कृपया अकादमी प्रशासनाशी संपर्क साधावा.\n- ${academyName}`;

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'STUDENT_BATCH_UNASSIGNED',
        metadata: {
          studentName: params.studentName,
          batchName: params.batchName,
          unassignedAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerBatchStudentUnassignedAutomation] Warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // AUTOMATION: NEW STUDENT REGISTRATION WELCOME
  // ============================================================================
  async triggerStudentWelcomeAutomation(params: {
    parentPhone: string;
    studentName: string;
    parentName?: string;
    course?: string;
    monthlyFee?: number;
  }) {
    try {
      const recipientPhone = queueService.normalizePhoneNumber(params.parentPhone);
      const feeInfo = params.monthlyFee ? `मासिक फी: ₹${params.monthlyFee}\nफी देय दिनांक: दर महिन्याची ५ तारीख` : '';
      const academyName = await this.getAcademyName();

      const baseBody = `*${academyName} मध्ये आपले सहर्ष स्वागत!* 🏆\n\nनमस्कार ${params.parentName || 'पालकमित्र'},\n*${params.studentName}* चा ${academyName} मध्ये प्रवेश घेतल्याबद्दल धन्यवाद.\nखेळ/प्रशिक्षण: ${params.course || 'क्रीडा प्रशिक्षण'}\n${feeInfo}\n\nआम्ही आपल्या पाल्यास दर्जेदार क्रीडा मार्गदर्शन देण्यासाठी कटिबद्ध आहोत.\n- ${academyName} प्रशासन`;
      const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, academyName);

      const queued = await queueService.enqueueMessage({
        recipientPhone,
        messageBody,
        eventType: 'STUDENT_WELCOME',
        metadata: {
          studentName: params.studentName,
          registeredAt: new Date().toISOString(),
        },
      });

      await queueService.processItem(queued);
      return queued;
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerStudentWelcomeAutomation] Warning:', err.message);
      return null;
    }
  }

  // ============================================================================
  // MESSAGE LOGS AUDIT
  // ============================================================================
  async listMessages(filters: MessageFilterQuery = {}) {
    let query = this.supabase
      .from('whatsapp_messages')
      .select(`
        *,
        student:students(id, name, course, parent_name),
        template:whatsapp_templates(id, name, event_type)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[WhatsAppAutomation.listMessages] Error:', error);
      throw new AppError(`Failed to list messages: ${error.message}`, 500);
    }

    return data || [];
  }

  // ============================================================================
  // MONTHLY PROGRESS & FEE STATEMENT PDF AUTOMATION
  // ============================================================================
  async generateStudentReportData(studentId: string): Promise<StudentReportData & { recipientPhone: string }> {
    const { data: student, error } = await this.supabase
      .from('students')
      .select(`
        id,
        name,
        parent_name,
        student_mobile,
        parent_whatsapp,
        course,
        admission_date,
        monthly_fee,
        fee_due_day,
        status,
        whatsapp_opt_in,
        batch_students (
          status,
          batches (
            id,
            name,
            subject,
            schedule_days,
            start_time,
            end_time
          )
        )
      `)
      .eq('id', studentId)
      .single();

    if (error || !student) {
      throw new AppError('Student not found', 404);
    }

    const recipientPhone = student.parent_whatsapp || student.student_mobile;
    if (!recipientPhone) {
      throw new AppError('Student has no parent WhatsApp or mobile number registered.', 400);
    }

    // Enrolled active batches
    const rawLinks = student.batch_students || [];
    const batches = rawLinks
      .filter((bs: any) => bs.status === 'ACTIVE' || !bs.status)
      .map((bs: any) => {
        const b = Array.isArray(bs.batches) ? bs.batches[0] : bs.batches;
        return {
          name: b?.name || 'Academic Batch',
          subject: b?.subject || 'Core Academics',
          scheduleDays: b?.schedule_days || [],
          startTime: b?.start_time || '',
          endTime: b?.end_time || '',
        };
      });

    // Attendance stats
    const { data: attendanceData } = await this.supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId);

    const totalSessions = (attendanceData || []).length;
    const presentCount = (attendanceData || []).filter((a: any) => a.status === 'PRESENT').length;
    const absentCount = (attendanceData || []).filter((a: any) => a.status === 'ABSENT').length;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    // Fees for current month
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data: feeData } = await this.supabase
      .from('student_fees')
      .select('amount_due, amount_paid, status')
      .eq('student_id', studentId)
      .eq('billing_period', billingPeriod)
      .maybeSingle();

    const monthlyFee = Number(student.monthly_fee || 0);
    const amountDue = feeData ? Number(feeData.amount_due || 0) : monthlyFee;
    const amountPaid = feeData ? Number(feeData.amount_paid || 0) : 0;
    const pendingAmount = Math.max(0, amountDue - amountPaid);
    const currentMonthStatus = feeData ? feeData.status : (monthlyFee > 0 ? 'PENDING' : 'NOT_ASSIGNED');

    // Academy Settings for branding
    const { data: academy } = await this.supabase
      .from('academy_settings')
      .select('academy_name, logo_url')
      .limit(1)
      .maybeSingle();
    const academyName = academy?.academy_name || (await this.getAcademyName());

    return {
      studentName: student.name,
      parentName: student.parent_name || undefined,
      course: student.course || undefined,
      studentMobile: student.student_mobile || undefined,
      parentWhatsapp: student.parent_whatsapp || undefined,
      admissionDate: student.admission_date || undefined,
      batches,
      attendance: {
        totalSessions,
        presentCount,
        absentCount,
        attendanceRate,
      },
      fees: {
        monthlyFee,
        feeDueDay: student.fee_due_day || 5,
        currentMonthStatus,
        pendingAmount,
        billingPeriod,
      },
      academyName,
      recipientPhone,
      logoUrl: academy?.logo_url || undefined,
    };
  }

  async sendStudentMonthlyReport(studentId: string) {
    const reportData = await this.generateStudentReportData(studentId);
    const pdfBuffer = await PdfReportService.generateStudentMonthlyReportPdf(reportData);
    const base64Doc = pdfBuffer.toString('base64');
    const safeStudentName = reportData.studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeStudentName}_Monthly_Report_${reportData.fees.billingPeriod}.pdf`;
    const academyName = reportData.academyName || (await this.getAcademyName());

    const feeStatusMarathi = reportData.fees.pendingAmount > 0 ? `थकीत: ₹${reportData.fees.pendingAmount}` : 'सर्व शुल्क जमा (Clear)';
    const caption = `*मासिक प्रगती व उपस्थिती अहवाल: ${academyName}*\n\nनमस्कार पालकमित्र,\n*${reportData.studentName}* चा *${reportData.fees.billingPeriod}* या महिन्याचा अधिकृत मासिक प्रगती अहवाल सोबत जोडला आहे.\n\n*उपस्थिती प्रमाण:* ${reportData.attendance.attendanceRate}% (${reportData.attendance.presentCount}/${reportData.attendance.totalSessions} सत्रे)\n*फी स्थिती:* ${feeStatusMarathi}\n\nकृपया सविस्तर माहिती व वेळापत्रकासाठी जोडलेली PDF फाईल तपासावी.\n\n- ${academyName} प्रशासन`;

    // Dispatch via companion socket
    const sendResult = await prototypeLinkedDeviceSender.sendDocument({
      to: reportData.recipientPhone,
      documentBase64: base64Doc,
      fileName,
      caption,
      mimetype: 'application/pdf',
    });

    // Record in whatsapp_messages log table
    try {
      await this.supabase.from('whatsapp_messages').insert({
        student_id: studentId,
        recipient_phone: reportData.recipientPhone,
        message_body: caption,
        event_type: 'CUSTOM_OUTBOX',
        status: sendResult.success ? 'SENT' : 'FAILED',
        provider_name: 'PROTOTYPE_LINKED_DEVICE',
        provider_message_id: sendResult.messageId || null,
        error_message: sendResult.errorMessage || null,
        sent_at: sendResult.success ? new Date().toISOString() : null,
        metadata: {
          type: 'MONTHLY_PDF_REPORT',
          fileName,
          billingPeriod: reportData.fees.billingPeriod,
        },
      });
    } catch {}

    return {
      success: sendResult.success,
      recipientPhone: reportData.recipientPhone,
      studentName: reportData.studentName,
      fileName,
      messageId: sendResult.messageId,
      error: sendResult.errorMessage,
    };
  }

  async sendAllMonthlyReportsBatch() {
    const { data: students, error } = await this.supabase
      .from('students')
      .select('id, name, status, whatsapp_opt_in, parent_whatsapp, student_mobile')
      .eq('status', 'ACTIVE');

    if (error || !students) {
      throw new AppError('Failed to fetch students for monthly report', 500);
    }

    const eligible = students.filter(
      (s) => s.whatsapp_opt_in !== false && (s.parent_whatsapp || s.student_mobile)
    );

    const results: any[] = [];
    for (let i = 0; i < eligible.length; i++) {
      const student = eligible[i];
      try {
        const res = await this.sendStudentMonthlyReport(student.id);
        results.push({ studentId: student.id, studentName: student.name, success: res.success });
      } catch (err: any) {
        results.push({ studentId: student.id, studentName: student.name, success: false, error: err.message });
      }

      // Safe 15-second gap between students to prevent spam bans!
      if (i < eligible.length - 1) {
        await new Promise((r) => setTimeout(r, 15000));
      }
    }

    return {
      totalEligible: eligible.length,
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      results,
    };
  }

  async getStudentReportPdfBuffer(studentId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const reportData = await this.generateStudentReportData(studentId);
    const buffer = await PdfReportService.generateStudentMonthlyReportPdf(reportData);
    const safeStudentName = reportData.studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeStudentName}_Monthly_Report_${reportData.fees.billingPeriod}.pdf`;
    return { buffer, fileName };
  }
}

export const automationService = new WhatsAppAutomationService();
