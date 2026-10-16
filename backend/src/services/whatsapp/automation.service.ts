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
import { whatsappProviderFactory } from './whatsappProvider.factory.js';
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

  async getAcademyUpiDetails(): Promise<{ upiId: string; payeeName: string; academyName: string }> {
    try {
      const { data } = await this.supabase
        .from('academy_settings')
        .select('academy_name, upi_id, upi_payee_name')
        .limit(1)
        .maybeSingle();
      return {
        academyName: data?.academy_name || 'Gurukul Sports Academy',
        upiId: data?.upi_id || 'gurukulsports@upi',
        payeeName: data?.upi_payee_name || data?.academy_name || 'Gurukul Sports Academy',
      };
    } catch {
      return {
        academyName: 'Gurukul Sports Academy',
        upiId: 'gurukulsports@upi',
        payeeName: 'Gurukul Sports Academy',
      };
    }
  }

  generateUpiPaymentLink(params: {
    upiId: string;
    payeeName: string;
    amount: number;
    transactionNote?: string;
  }): string {
    const { upiId, payeeName, amount, transactionNote = 'Gurukul Sports Academy Monthly Training Fee' } = params;
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
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
      return `${baseBody}\n\n📌 _Note: Krupaya pudhil sarva updates sathi ha official ${academyName} contact number save karun theva._`;
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

    // Log overdue tracking information
    if (fee.due_date) {
      const dueDateMs = new Date(fee.due_date).getTime();
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        console.log(`[WhatsAppAutomation] Fee for student ${student.name} is overdue by ${daysOverdue} days. Dispatching reminder.`);
      }
    }

    // Zero-Cut Direct UPI Payment Link (0.00% gateway charges)
    const upiDetails = await this.getAcademyUpiDetails();
    const zeroCutUpiLink = this.generateUpiPaymentLink({
      upiId: upiDetails.upiId,
      payeeName: upiDetails.payeeName,
      amount: pendingAmount,
      transactionNote: `Gurukul Academy Training Fee - ${student.name}`,
    });
    console.log(`[WhatsAppAutomation] Generating Zero-Cut Fee Reminder for student ${student.name} (Rs. ${pendingAmount}) with UPI Link: ${zeroCutUpiLink}`);

    const baseBody = this.renderTemplate(template.body, {
      academy_name: upiDetails.academyName,
      student_name: student.name,
      parent_name: student.parent_name || 'Parent',
      phone: recipientPhone,
      course_name: student.course || 'Course',
      amount: pendingAmount.toString(),
      pending_amount: pendingAmount.toString(),
      due_date: fee.due_date,
      payment_link: zeroCutUpiLink,
      upi_id: upiDetails.upiId,
      upi_payee_name: upiDetails.payeeName,
      razorpay_payment_link: zeroCutUpiLink,
      date: new Date().toISOString().split('T')[0],
    });

    const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, upiDetails.academyName);

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
  // AUTOMATION: SMART MULTI-STAGE FEE CADENCE AUTOMATION (0% GATEWAY FEES)
  // Stages:
  // - T-5 (5 Days Before Due Date): Advance Courtesy Notice (FEE_UPCOMING)
  // - T-2 (2 Days Before Due Date): Gentle Advance Notice (FEE_UPCOMING)
  // - T-1 (1 Day Before Due Date): Due Tomorrow Alert (FEE_DUE)
  // - T-0 (Due Date): Due Today Alert (FEE_DUE)
  // - T+2 (2 Days Overdue): Late Follow-up (FEE_OVERDUE)
  // - T+5 (5 Days Overdue): Final Late Notice before Admin Escalation (FEE_OVERDUE)
  // Anti-Ban:
  // - 15-21s dynamic throttle
  // - Idempotency key per student, billing period, and cadence stage
  // ============================================================================
  async triggerMultiStageFeeCadenceAutomation(options?: { forceAllUnpaid?: boolean }) {
    try {
      const upiDetails = await this.getAcademyUpiDetails();

      // Fetch active students and their fee records
      const { data: students, error: studentError } = await this.supabase
        .from('students')
        .select(`
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile,
          course,
          monthly_fee,
          fee_due_day,
          status
        `)
        .eq('status', 'ACTIVE');

      if (studentError || !students) {
        console.error('[WhatsAppAutomation] Failed to fetch active students for fee cadence:', studentError?.message);
        return { queuedCount: 0, escalatedCount: 0, skippedCount: 0, error: studentError?.message };
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const todayStr = now.toISOString().split('T')[0];
      const todayMs = new Date(currentYear, currentMonth, now.getDate()).getTime();

      // Current billing period YYYY-MM
      const currentBillingPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      // Fetch fee records for current billing period
      const { data: feeRecords } = await this.supabase
        .from('student_fees')
        .select('id, student_id, amount_due, amount_paid, due_date, status, billing_period')
        .eq('billing_period', currentBillingPeriod);

      const feeMap = new Map<string, any>();
      (feeRecords || []).forEach((f: any) => feeMap.set(f.student_id, f));

      const eligibleItems: any[] = [];
      let escalatedCount = 0;
      let skippedCount = 0;

      for (const student of students) {
        const recipientPhone = student.parent_whatsapp || student.student_mobile;
        if (!recipientPhone) {
          skippedCount++;
          continue;
        }

        const feeRecord = feeMap.get(student.id);
        const monthlyFee = Number(student.monthly_fee || 0);
        const amountDue = feeRecord ? Number(feeRecord.amount_due) : monthlyFee;
        const amountPaid = feeRecord ? Number(feeRecord.amount_paid) : 0;
        const pendingAmount = Math.max(0, amountDue - amountPaid);

        // If no pending fee or monthly fee is 0, nothing due!
        if (pendingAmount <= 0) {
          skippedCount++;
          continue;
        }

        // Determine student's due date for the cycle
        const dueDay = student.fee_due_day || 1; // Default 1st of month (or 5th)
        let dueDate = feeRecord?.due_date ? new Date(feeRecord.due_date) : new Date(currentYear, currentMonth, dueDay);
        dueDate.setHours(0, 0, 0, 0);

        const dueDateMs = dueDate.getTime();
        const diffDays = Math.round((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
        const dueDateFormatted = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        let eventType: WhatsAppEventType | null = null;
        let cadenceStage: string | null = null;

        if (options?.forceAllUnpaid) {
          if (diffDays < 0) {
            eventType = 'FEE_OVERDUE';
            cadenceStage = 'FORCE_OVERDUE';
          } else {
            eventType = 'FEE_DUE';
            cadenceStage = 'FORCE_DUE';
          }
        } else {
          // Strict Cadence Stages:
          if (diffDays === 5) {
            eventType = 'FEE_UPCOMING';
            cadenceStage = 'T_MINUS_5';
          } else if (diffDays === 2) {
            eventType = 'FEE_UPCOMING';
            cadenceStage = 'T_MINUS_2';
          } else if (diffDays === 1) {
            eventType = 'FEE_DUE';
            cadenceStage = 'T_MINUS_1';
          } else if (diffDays === 0) {
            eventType = 'FEE_DUE';
            cadenceStage = 'T_ZERO';
          } else if (diffDays === -2) {
            eventType = 'FEE_OVERDUE';
            cadenceStage = 'T_PLUS_2';
          } else if (diffDays === -5) {
            eventType = 'FEE_OVERDUE';
            cadenceStage = 'T_PLUS_5';
          } else if (diffDays < -5) {
            // Overdue > 5 days: Stop automatic spam! Escalated to Admin dashboard
            escalatedCount++;
            continue;
          } else {
            // Not a cadence day (e.g. 4 days before, 3 days before, 1 day overdue, 3 days overdue)
            skippedCount++;
            continue;
          }
        }

        if (!eventType || !cadenceStage) {
          skippedCount++;
          continue;
        }

        const template = await templateService.getActiveTemplateForEvent(eventType);
        if (!template) {
          console.warn(`[WhatsAppAutomation] No active template for ${eventType}. Skipping student ${student.name}.`);
          continue;
        }

        // Generate 0-cut direct UPI deep-link
        const zeroCutUpiLink = this.generateUpiPaymentLink({
          upiId: upiDetails.upiId,
          payeeName: upiDetails.payeeName,
          amount: pendingAmount,
          transactionNote: `Gurukul Fee ${currentBillingPeriod} - ${student.name}`,
        });

        const baseBody = this.renderTemplate(template.body, {
          academy_name: upiDetails.academyName,
          student_name: student.name,
          parent_name: student.parent_name || 'Parent',
          phone: recipientPhone,
          course_name: student.course || 'Athletics & Martial Arts',
          amount: pendingAmount.toString(),
          pending_amount: pendingAmount.toString(),
          due_date: dueDateFormatted,
          payment_link: zeroCutUpiLink,
          upi_id: upiDetails.upiId,
          upi_payee_name: upiDetails.payeeName,
          razorpay_payment_link: zeroCutUpiLink,
          date: todayStr,
        });

        const messageBody = await this.formatMessageWithOnboardingNote(baseBody, recipientPhone, upiDetails.academyName);

        // Strict Idempotency Key: guarantees no duplicate send per student per billingPeriod per cadenceStage
        const idempotencyKey = `FEE_CADENCE:${student.id}:${currentBillingPeriod}:${cadenceStage}:${todayStr}`;

        eligibleItems.push({
          recipientPhone,
          messageBody,
          studentId: student.id,
          templateId: template.id,
          eventType,
          idempotencyKey,
          metadata: {
            cadenceStage,
            billingPeriod: currentBillingPeriod,
            dueDay,
            diffDays,
            pendingAmount,
            upiId: upiDetails.upiId,
          },
        });
      }

      if (eligibleItems.length === 0) {
        return {
          queuedCount: 0,
          escalatedCount,
          skippedCount,
          message: 'No students matched fee cadence trigger for today.',
        };
      }

      // Enqueue batch with 15-21s anti-ban throttle
      const queuedItems = await queueService.enqueueBatchStaggered(eligibleItems, 15000);

      return {
        queuedCount: queuedItems.length,
        escalatedCount,
        skippedCount,
        estimatedMinutes: Math.round((queuedItems.length * 16) / 60),
        cadenceDetails: eligibleItems.map((item) => ({
          studentId: item.studentId,
          recipientPhone: item.recipientPhone,
          stage: item.metadata?.cadenceStage,
          diffDays: item.metadata?.diffDays,
          amount: item.metadata?.pendingAmount,
        })),
      };
    } catch (err: any) {
      console.warn('[WhatsAppAutomation.triggerMultiStageFeeCadenceAutomation] Error:', err.message);
      return { queuedCount: 0, escalatedCount: 0, skippedCount: 0, error: err.message };
    }
  }

  // Backward compatibility alias for manual sweep / legacy route
  async triggerMonthly5thFeeDueAutomation() {
    return this.triggerMultiStageFeeCadenceAutomation({ forceAllUnpaid: true });
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
      const scheduleInfo = params.scheduleDays?.length ? `Schedule: ${params.scheduleDays.join(', ')}` : '';
      const timeInfo = params.startTime && params.endTime ? `Time: ${params.startTime} - ${params.endTime}` : '';
      const academyName = await this.getAcademyName();

      const baseBody = `*Batch Enrollment Confirmed*\n\nDear Parent,\n*${params.studentName}* has been successfully enrolled into batch:\n*Batch:* ${params.batchName} (${params.subject || 'Sports Training'})\n${scheduleInfo}\n${timeInfo}\n\nWe look forward to an outstanding athletic journey.\n- ${academyName}`;
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
      const messageBody = `*Notice: ${academyName}*\n\nDear Parent,\n*${params.studentName}* has been unassigned from batch *${params.batchName}*.\n\nPlease contact academy administration if you have questions.\n- ${academyName}`;

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
      const feeInfo = params.monthlyFee ? `Monthly Training Fee: ₹${params.monthlyFee}\nDue Date: 5th of every month` : '';
      const academyName = await this.getAcademyName();

      const baseBody = `*Welcome to ${academyName}* 🏆\n\nDear ${params.parentName || 'Parent'},\nThank you for enrolling *${params.studentName}* at ${academyName}.\nProgram: ${params.course || 'Sports Coaching'}\n${feeInfo}\n\nWe are committed to providing top-quality training for your child's athletic growth.\n- ${academyName} Administration`;
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
        student:students(id, name, course, parent_name)
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

    // Academy Settings for branding & 0% UPI Payments
    const { data: academy } = await this.supabase
      .from('academy_settings')
      .select('academy_name, logo_url, upi_id, upi_payee_name')
      .limit(1)
      .maybeSingle();
    const academyName = academy?.academy_name || (await this.getAcademyName());

    // Martial Arts Belt & Rank Progression Result
    let martialArtsRank = undefined;
    try {
      const { data: srData } = await this.supabase
        .from('student_ranks')
        .select(`
          discipline_code,
          reg_number,
          promoted_at,
          promoted_by,
          martial_arts_ranks (
            rank_name,
            belt_color
          )
        `)
        .eq('student_id', studentId)
        .order('promoted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: promData } = await this.supabase
        .from('rank_promotions')
        .select(`
          discipline_code,
          previous_rank_name,
          new_rank_name,
          reg_number,
          promotion_date,
          promoted_by,
          certificate_number
        `)
        .eq('student_id', studentId)
        .order('promotion_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (srData) {
        martialArtsRank = {
          disciplineName: srData.discipline_code === 'KALARIPPAYATTU'
            ? 'Kalarippayattu'
            : srData.discipline_code === 'KARATE_WUSHU'
            ? 'Karate + Wushu'
            : srData.discipline_code === 'KICKBOXING'
            ? 'Kickboxing'
            : srData.discipline_code === 'GYMNASTICS'
            ? 'Gymnastics & Acrobatics'
            : 'Martial Arts',
          currentRankName: (srData.martial_arts_ranks as any)?.rank_name || promData?.new_rank_name || 'Active Trainee',
          beltColor: (srData.martial_arts_ranks as any)?.belt_color || 'Yellow',
          regNumber: srData.reg_number || promData?.reg_number || undefined,
          promotedAt: promData?.promotion_date || srData.promoted_at || undefined,
          examinerName: promData?.promoted_by || srData.promoted_by || 'Chief Master (Gurukul Academy)',
          certificateNumber: promData?.certificate_number || 'GSA-CERTIFIED',
          previousRankName: promData?.previous_rank_name || undefined,
          examResult: 'PASSED & PROMOTED',
        };
      }
    } catch (rErr) {
      console.warn('Rank query fallback in generateStudentReportData:', rErr);
    }

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
        upiId: academy?.upi_id || 'gurukulsports@upi',
        upiPayeeName: academy?.upi_payee_name || academyName,
      },
      martialArtsRank,
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

    const feeStatus = reportData.fees.pendingAmount > 0 ? `Pending: Rs. ${reportData.fees.pendingAmount}` : 'All Clear';
    const upiPayNote = reportData.fees.pendingAmount > 0 && reportData.fees.upiId
      ? `\n\n💳 *Direct 0% Cut UPI Pay:* ${reportData.fees.upiId}\n📱 *1-Tap Pay:* upi://pay?pa=${encodeURIComponent(reportData.fees.upiId)}&pn=${encodeURIComponent(academyName)}&am=${reportData.fees.pendingAmount}&cu=INR&tn=${encodeURIComponent(`Monthly Fee - ${reportData.studentName}`)}`
      : '';
    const caption = `*Monthly Progress & Attendance Report: ${academyName}*\n\nDear Parent,\nPlease find attached the official monthly progress report for *${reportData.studentName}* for the month of *${reportData.fees.billingPeriod}*.\n\n*Attendance Rate:* ${reportData.attendance.attendanceRate}% (${reportData.attendance.presentCount}/${reportData.attendance.totalSessions} Sessions)\n*Fee Status:* ${feeStatus}${upiPayNote}\n\nPlease review the attached document for detailed session breakdown.\n\n- ${academyName} Administration`;

    // Dispatch via active connected provider
    const provider = whatsappProviderFactory.getProvider();
    let sendResult: any;
    if (provider.sendDocument) {
      sendResult = await provider.sendDocument({
        to: reportData.recipientPhone,
        documentBase64: base64Doc,
        fileName,
        caption,
        mimetype: 'application/pdf',
      });
    } else {
      sendResult = await prototypeLinkedDeviceSender.sendDocument({
        to: reportData.recipientPhone,
        documentBase64: base64Doc,
        fileName,
        caption,
        mimetype: 'application/pdf',
      });
    }

    // Record in whatsapp_messages log table
    try {
      await this.supabase.from('whatsapp_messages').insert({
        student_id: studentId,
        recipient_phone: reportData.recipientPhone,
        message_body: caption,
        event_type: 'CUSTOM_OUTBOX',
        status: sendResult.success ? 'SENT' : 'FAILED',
        provider_name: provider.name,
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

      // Safe 3.5-second gap between students to prevent spam bans
      if (i < eligible.length - 1) {
        await new Promise((r) => setTimeout(r, 3500));
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

  /**
   * Generates and dispatches an official branded PDF fee receipt to parent via WhatsApp
   */
  async sendFeeReceiptPdf(receiptId: string): Promise<{ success: boolean; message: string; data?: any }> {
    const { receiptService } = await import('../receipt.service.js');
    const { receipt, academy } = await receiptService.getReceiptById(receiptId);

    const student = (receipt as any).student;
    if (!student) {
      throw new AppError('Student information not associated with this receipt', 404, 'RESOURCE_NOT_FOUND');
    }

    const recipientPhone = student.parent_whatsapp || student.student_mobile;
    if (!recipientPhone) {
      throw new AppError('Student has no WhatsApp/mobile number on record', 400, 'PHONE_NOT_FOUND');
    }

    const payment = (receipt as any).payment || {};
    const academyName = academy?.name || 'Gurukul Sports Academy';

    const pdfBuffer = await PdfReportService.generateReceiptPdf({
      receiptNumber: receipt.receipt_number,
      studentName: student.name,
      course: student.course,
      amount: Number(receipt.amount),
      issuedAt: receipt.issued_at,
      paymentMode: payment.provider || 'ONLINE/UPI',
      transactionRef: payment.provider_payment_id || payment.id,
      academyName,
      academyAddress: academy?.address,
      academyPhone: academy?.contact_phone,
      academyEmail: academy?.contact_email,
    });

    const base64Doc = pdfBuffer.toString('base64');
    const fileName = `Receipt_${receipt.receipt_number}_${student.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const caption = `🧾 *Official Payment Receipt #${receipt.receipt_number}*\n\nDear Parent,\nThank you for your fee payment of *₹${Number(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}* for *${student.name}* (${student.course || 'Training'}).\n\nPlease find your official digitally verified receipt attached.\n\n- *${academyName} Accounts Department*`;

    const provider = whatsappProviderFactory.getProvider();
    let sendResult: any;
    if (provider.sendDocument) {
      sendResult = await provider.sendDocument({
        to: recipientPhone,
        documentBase64: base64Doc,
        fileName,
        caption,
        mimetype: 'application/pdf',
      });
    } else {
      sendResult = await prototypeLinkedDeviceSender.sendDocument({
        to: recipientPhone,
        documentBase64: base64Doc,
        fileName,
        caption,
        mimetype: 'application/pdf',
      });
    }

    // Record in whatsapp_messages log table
    try {
      await this.supabase.from('whatsapp_messages').insert({
        student_id: student.id,
        recipient_phone: recipientPhone,
        message_body: caption,
        event_type: 'PAYMENT_RECEIVED',
        status: sendResult.success ? 'SENT' : 'FAILED',
        provider_name: provider.name,
        provider_message_id: sendResult.messageId || null,
        error_message: sendResult.errorMessage || null,
        sent_at: sendResult.success ? new Date().toISOString() : null,
        metadata: {
          type: 'RECEIPT_PDF',
          receiptNumber: receipt.receipt_number,
          amount: receipt.amount,
        },
      });
    } catch {}

    if (!sendResult.success) {
      throw new AppError(sendResult.errorMessage || 'Failed to send receipt PDF via WhatsApp', 500);
    }

    return {
      success: true,
      message: `Official receipt PDF dispatched to ${student.name} (${recipientPhone}) via WhatsApp!`,
      data: {
        receiptId: receipt.id,
        receiptNumber: receipt.receipt_number,
        recipientPhone,
        messageId: sendResult.messageId,
      },
    };
  }
}

export const automationService = new WhatsAppAutomationService();
