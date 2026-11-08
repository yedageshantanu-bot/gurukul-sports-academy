import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { env } from '../../config/env.js';
import { requestContext } from '../../config/requestContext.js';
import { ROLES } from '../../constants/index.js';
import { templateService } from './template.service.js';
import { queueService, isBlockedOrDummyNumber } from './queue.service.js';
import {
  SendCustomMessageDTO,
  MessageFilterQuery,
  WhatsAppEventType,
} from '../../types/whatsapp.types.js';
import { PdfReportService, StudentReportData } from '../pdfReport.service.js';
import { prototypeLinkedDeviceSender } from './prototypeLinkedDeviceSender.js';
import { whatsappProviderFactory } from './whatsappProvider.factory.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
export function cleanParentName(name?: string | null, studentName?: string | null): string {
  const sName = studentName && studentName.trim() && studentName.trim().toLowerCase() !== 'student'
    ? studentName.trim()
    : '';

  if (!name) {
    return sName ? `${sName} Palak` : 'Palak';
  }

  const trimmed = name.trim();
  // Check if string is only punctuation or placeholder word (e.g. '.', '..', '-', 'null', 'none')
  const isJunk = /^[\s.\-_,;:'"`]+$/.test(trimmed) || /^(null|undefined|none|na|n\/a|\.)$/i.test(trimmed);
  if (isJunk) {
    return sName ? `${sName} Palak` : 'Palak';
  }

  // Strip leading & trailing dots, dashes, commas, semicolons
  const cleaned = trimmed.replace(/^[\s.\-_,;:'"]+|[\s.\-_,;:'"]+$/g, '').trim();
  if (!cleaned || /^[\s.\-_,;:'"`]+$/.test(cleaned) || /^(null|undefined|none|na|n\/a|\.)$/i.test(cleaned)) {
    return sName ? `${sName} Palak` : 'Palak';
  }

  return cleaned;
}

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

  generateUpiPaymentLink(_params: {
    upiId: string;
    payeeName: string;
    amount: number;
    transactionNote?: string;
  }): string {
    // Strictly return empty string: raw upi:// deep links are disabled per academy policy
    return '';
  }

  // ============================================================================
  // TEMPLATE RENDERING (Supports all CRM Variables)
  // Supports both single {variable} and double {{variable}} braces
  // ============================================================================
  renderTemplate(templateBody: string, variables: Record<string, string>): string {
    let rendered = templateBody;

    // Apply smart fail-safe fallbacks for core variables upfront
    const studentName = (variables.student_name || variables.studentName || 'Student').trim();
    const rawParent = variables.parent_name || variables.parentName || '';
    const parentName = cleanParentName(rawParent, studentName);
    const recipientName = (variables.name || variables.recipient_name || variables.recipientName || variables.user_name || variables.userName || studentName).trim();
    const course = variables.course || variables.course_name || variables.courseName || 'Sports Training';
    const amount = variables.pending_amount || variables.amount || variables.pendingAmount || '0';
    const dueDate = variables.due_date || variables.dueDate || '5th of this month';
    const paymentLink = variables.payment_link || variables.paymentLink || '';
    const status = variables.status || variables.attendance_status || variables.status_text || 'ABSENT';

    const safeVars = {
      ...variables,
      parent_name: parentName,
      parentName: parentName,
      student_name: studentName,
      studentName: studentName,
      name: recipientName,
      user_name: recipientName,
      userName: recipientName,
      recipient_name: recipientName,
      recipientName: recipientName,
      course: course,
      course_name: course,
      courseName: course,
      amount: amount,
      pending_amount: amount,
      pendingAmount: amount,
      due_date: dueDate,
      dueDate: dueDate,
      payment_link: paymentLink,
      paymentLink: paymentLink,
      status: status,
      attendance_status: status,
    };

    const expandedVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(safeVars)) {
      const valStr = value !== undefined && value !== null ? String(value) : '';
      expandedVars[key] = valStr;

      // CamelCase conversion: student_name -> studentName
      const camel = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
      expandedVars[camel] = valStr;

      // SnakeCase conversion: studentName -> student_name
      const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      expandedVars[snake] = valStr;

      // Lowercase alphanumeric: studentname
      expandedVars[key.toLowerCase().replace(/_/g, '')] = valStr;
    }

    // Replace both double {{var}} and single {var} braces
    for (const [key, value] of Object.entries(expandedVars)) {
      const regex = new RegExp(`(?:\\{\\{|\\{)\\s*${key}\\s*(?:\\}\\}|\\})`, 'gi');
      rendered = rendered.replace(regex, value);
    }

    // Final safety pass for any unreplaced core tag variations
    rendered = rendered
      .replace(/(?:\{\{|\{)\s*(?:parent_name|parentName|parent)\s*(?:\}\}|\})/gi, parentName)
      .replace(/(?:\{\{|\{)\s*(?:student_name|studentName|student)\s*(?:\}\}|\})/gi, studentName)
      .replace(/(?:\{\{|\{)\s*(?:name|user_name|userName|recipient_name|recipientName|recipient|user)\s*(?:\}\}|\})/gi, recipientName)
      .replace(/(?:\{\{|\{)\s*(?:course|course_name|courseName)\s*(?:\}\}|\})/gi, course)
      .replace(/(?:\{\{|\{)\s*(?:pending_amount|pendingAmount|amount)\s*(?:\}\}|\})/gi, amount)
      .replace(/(?:\{\{|\{)\s*(?:due_date|dueDate)\s*(?:\}\}|\})/gi, dueDate)
      .replace(/(?:\{\{|\{)\s*(?:status|attendance_status)\s*(?:\}\}|\})/gi, status)
      .replace(/(?:\{\{|\{)\s*(?:payment_link|paymentLink|razorpay_payment_link)\s*(?:\}\}|\})/gi, paymentLink);

    // Safeguard: replace any inadvertent "unknown user" or "unknown student" with actual student/recipient name
    rendered = rendered.replace(/\b(?:unknown\s*user|unknown\s*student|unknown\s*member)\b/gi, studentName || 'Athlete');

    // Specific cleanup for parent greetings: never print isolated dots or punctuation before "ji" or "!"
    rendered = rendered.replace(/Namaste\s*[\.\-_,\s]*\s*ji\s*!/gi, 'Namaste Ji! 🙏');
    rendered = rendered.replace(/Namaste\s*[\.\-_,\s]+!/gi, 'Namaste Ji! 🙏');
    rendered = rendered.replace(/Namaste\s+Palak\s+ji\s*!/gi, 'Namaste Palak Ji! 🙏');
    rendered = rendered.replace(/\b([a-zA-Z\u0900-\u097F]+)\s*[\.\-_,]+\s*ji\s*!/gi, '$1 Ji! 🙏');
    rendered = rendered.replace(/\bji\s*!/gi, 'Ji!');
    rendered = rendered.replace(/\bji\b/g, 'Ji');

    // Clean up awkward spaces before punctuation
    rendered = rendered.replace(/\s+([!?,;:])/g, '$1');
    rendered = rendered.replace(/!\s*🙏/g, '! 🙏');
    rendered = rendered.replace(/([^\s])\s*🙏/g, '$1 🙏');
    rendered = rendered.replace(/(?:!\s*🙏\s*)+/g, '! 🙏');
    rendered = rendered.replace(/🙏(?:\s*🙏)+/g, '🙏');

    // Strict safety filter: strip any raw upi:// deep links or raw UPI payment commands
    rendered = rendered.replace(/upi:\/\/pay[^\s\n]*/gi, '');
    rendered = rendered.replace(/(?:📱\s*\*?(?:Direct\s*(?:1-Tap|0%)\s*UPI|1-Tap\s*Pay|UPI\s*Pay)\*?:?)[^\n]*/gi, '');
    rendered = rendered.replace(/(?:(?:Or\s*)?pay\s*(?:via\s*(?:GPay\s*\/\s*PhonePe|UPI)\s*)?(?:to\s*)?UPI\s*ID\s*:\s*\*?[a-zA-Z0-9.\-_@]+\*?)/gi, '');
    rendered = rendered.replace(/UPI\s*ID\s*:\s*\*?[a-zA-Z0-9.\-_@]+\*?/gi, '');

    // Clean up excessive blank lines & awkward gaps
    rendered = rendered.replace(/[ \t]+\n/g, '\n');
    rendered = rendered.replace(/\n{3,}/g, '\n\n').trim();

    return rendered;
  }

  /**
   * Checks how many times the onboarding "save contact" note was sent to this phone.
   */
  async getSaveNoteCount(phone: string): Promise<number> {
    if (!phone) return 999;
    try {
      const digits = phone.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (!last10) return 999;
      const e164 = `+91${last10}`;

      const [msgRes, queueRes] = await Promise.all([
        this.supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .or(`recipient_phone.eq.${e164},recipient_phone.eq.${digits},recipient_phone.ilike.%${last10}`)
          .ilike('message_body', '%save this official contact number%'),
        this.supabase
          .from('whatsapp_queue')
          .select('id', { count: 'exact', head: true })
          .or(`recipient_phone.eq.${e164},recipient_phone.eq.${digits},recipient_phone.ilike.%${last10}`)
          .ilike('message_body', '%save this official contact number%'),
      ]);

      return (msgRes.count || 0) + (queueRes.count || 0);
    } catch {
      return 0;
    }
  }

  /**
   * Checks whether this phone number has ever received a message from our academy before.
   * Returns how many prior WhatsApp messages have been sent to this recipient phone.
   */
  async getPriorMessageCount(phone: string): Promise<number> {
    try {
      const digits = phone.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      const e164 = `+91${last10}`;
      const { count, error } = await this.supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .or(`recipient_phone.eq.${e164},recipient_phone.eq.${digits},recipient_phone.ilike.%${last10}`);

      if (!error && typeof count === 'number') {
        return count;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async hasReceivedPriorMessages(phone: string): Promise<boolean> {
    const count = await this.getPriorMessageCount(phone);
    return count >= 2;
  }

  /**
   * Intelligently formats message with onboarding note:
   * STRICTLY ONLY appends to maximum 2 messages sent to any phone number.
   * "📌 Please save this official contact number in your phone as Gurukul Sports Academy."
   */
  async formatMessageWithOnboardingNote(baseBody: string, phone: string, academyName: string): Promise<string> {
    if (!phone) return baseBody;
    try {
      const noteCount = await this.getSaveNoteCount(phone);
      if (noteCount < 2) {
        const officialAcademyName = academyName || 'Gurukul Sports Academy';
        const onboardingNote = `\n\n📌 Please save this official contact number in your phone as ${officialAcademyName}.`;
        if (!baseBody.includes('Please save this official contact number')) {
          return `${baseBody.trim()}${onboardingNote}`;
        }
      }
    } catch {
      // Non-blocking fallback
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
    customTemplate?: string;
  }) {
    try {
      // 1. Get active template or custom template
      const template = await templateService.getActiveTemplateForEvent('ATTENDANCE_ABSENT');
      const rawTemplate = params.customTemplate?.trim() || template?.body;
      if (!rawTemplate) {
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
      const baseBody = this.renderTemplate(rawTemplate, {
        academy_name: academyName,
        student_name: student.name,
        parent_name: student.parent_name || 'Parent',
        phone: recipientPhone,
        course_name: student.course || 'Course',
        batch_name: batchName,
        date: params.date,
        status: 'ABSENT',
        attendance_status: 'ABSENT',
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
        status: 'PRESENT',
        attendance_status: 'PRESENT',
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
      // Guard against accidental 0 or negative fee alert blasts
      if (!params.amount || Number(params.amount) <= 0) {
        console.log('[WhatsAppAutomation] Payment amount is 0 or invalid. Skipping payment confirmation alert.');
        return null;
      }

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
    studentId?: string;
    studentFeeId?: string;
    eventType?: 'FEE_DUE' | 'FEE_OVERDUE' | 'FEE_UPCOMING' | 'FEE_OVERDUE_ALERT' | 'FEE_DUE_REMINDER';
    customTemplate?: string;
  }) {
    let eventType: WhatsAppEventType = 'FEE_DUE';
    if (params.eventType === 'FEE_OVERDUE_ALERT' || params.eventType === 'FEE_OVERDUE') {
      eventType = 'FEE_OVERDUE';
    } else if (params.eventType === 'FEE_UPCOMING') {
      eventType = 'FEE_UPCOMING';
    } else {
      eventType = 'FEE_DUE';
    }

    const template = await templateService.getActiveTemplateForEvent(eventType);
    if (!template && !params.customTemplate) {
      throw new AppError(`No active template found for ${eventType}`, 400, 'TEMPLATE_NOT_FOUND');
    }

    // Resilient lookup: query student_fees by studentFeeId, or fallback to latest fee for studentId
    let fee: any = null;
    if (params.studentFeeId) {
      const feeRes = await this.supabase
        .from('student_fees')
        .select('id, student_id, amount_due, amount_paid, due_date, billing_period')
        .eq('id', params.studentFeeId)
        .maybeSingle();
      fee = feeRes.data;
    }

    const targetStudentId = params.studentId || fee?.student_id;
    if (!targetStudentId) {
      throw new AppError('Student identifier not provided or associated with this fee record', 404, 'RESOURCE_NOT_FOUND');
    }

    if (!fee) {
      const feeRes = await this.supabase
        .from('student_fees')
        .select('id, student_id, amount_due, amount_paid, due_date, billing_period')
        .eq('student_id', targetStudentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      fee = feeRes.data;
    }

    const studentRes = await this.supabase
      .from('students')
      .select('id, name, parent_name, parent_whatsapp, student_mobile, course, monthly_fee')
      .eq('id', targetStudentId)
      .single();

    if (studentRes.error || !studentRes.data) {
      throw new AppError('Student not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const student = studentRes.data;
    const pendingAmount = fee
      ? Math.max(0, Number(fee.amount_due) - Number(fee.amount_paid))
      : Number(student.monthly_fee || 1500);

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

    const upiDetails = await this.getAcademyUpiDetails();
    console.log(`[WhatsAppAutomation] Generating Fee Reminder for student ${student.name} (Rs. ${pendingAmount})`);

    const rawTemplateBody = (params.customTemplate && params.customTemplate.trim()) || template?.body || '';
    const parentNameFallback = cleanParentName(student.parent_name, student.name);

    const baseBody = this.renderTemplate(rawTemplateBody, {
      academy_name: upiDetails.academyName || 'Gurukul Sports Academy',
      student_name: student.name || 'Student',
      studentName: student.name || 'Student',
      parent_name: parentNameFallback,
      parentName: parentNameFallback,
      phone: recipientPhone,
      course_name: student.course || 'Sports Training',
      course: student.course || 'Sports Training',
      amount: pendingAmount.toString(),
      pending_amount: pendingAmount.toString(),
      pendingAmount: pendingAmount.toString(),
      due_date: fee.due_date || '5th of this month',
      dueDate: fee.due_date || '5th of this month',
      payment_link: '',
      paymentLink: '',
      upi_id: '',
      upi_payee_name: '',
      razorpay_payment_link: '',
      date: new Date().toISOString().split('T')[0],
    });

    // Deliver exact configured fee template text without appending activation/onboarding notes
    const messageBody = baseBody;

    const queued = await queueService.enqueueMessage({
      recipientPhone,
      messageBody,
      studentId: student.id,
      templateId: template?.id,
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
    if (!options?.forceAllUnpaid) {
      console.log('[WhatsAppAutomation] Automated background fee cadence is PAUSED per configuration until client review. Reminders can only be triggered explicitly by admin.');
      return {
        queuedCount: 0,
        escalatedCount: 0,
        skippedCount: 0,
        message: 'Automated background fee cadence is paused until client review. Reminders can only be triggered explicitly by admin.',
      };
    }

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

      // Fetch all fee records to aggregate cumulative dues per student across all cycles
      const { data: feeRecords } = await this.supabase
        .from('student_fees')
        .select('id, student_id, amount_due, amount_paid, due_date, status, billing_period')
        .order('due_date', { ascending: true });

      const studentFeeRecordsMap = new Map<string, any[]>();
      (feeRecords || []).forEach((f: any) => {
        if (!studentFeeRecordsMap.has(f.student_id)) {
          studentFeeRecordsMap.set(f.student_id, []);
        }
        studentFeeRecordsMap.get(f.student_id)!.push(f);
      });

      const eligibleItems: any[] = [];
      let escalatedCount = 0;
      let skippedCount = 0;

      for (const student of students) {
        const recipientPhone = student.parent_whatsapp || student.student_mobile;
        if (!recipientPhone) {
          skippedCount++;
          continue;
        }

        const records = studentFeeRecordsMap.get(student.id) || [];
        const monthlyFee = Number(student.monthly_fee || 0);

        let amountDue = 0;
        let amountPaid = 0;
        let latestDueDate: Date | null = null;
        let hasOverdue = false;

        if (records.length === 0) {
          amountDue = monthlyFee;
          amountPaid = 0;
          latestDueDate = new Date(currentYear, currentMonth, student.fee_due_day || 1);
        } else {
          for (const rec of records) {
            const rDue = Number(rec.amount_due || 0);
            const rPaid = Number(rec.amount_paid || 0);
            amountDue += rDue;
            amountPaid += rPaid;
            if (rec.due_date && (!latestDueDate || new Date(rec.due_date) > latestDueDate)) {
              latestDueDate = new Date(rec.due_date);
            }
            if (rec.status === 'OVERDUE' || (rec.due_date && new Date(rec.due_date) < new Date(todayStr) && rDue > rPaid)) {
              hasOverdue = true;
            }
          }
        }

        const pendingAmount = Math.max(0, amountDue - amountPaid);

        // If no pending fee or monthly fee is 0, nothing due!
        if (pendingAmount <= 0) {
          skippedCount++;
          continue;
        }

        // Determine student's due date for the cycle
        const dueDay = student.fee_due_day || 1; // Default 1st of month (or 5th)
        let dueDate = latestDueDate || new Date(currentYear, currentMonth, dueDay);
        dueDate.setHours(0, 0, 0, 0);

        const dueDateMs = dueDate.getTime();
        const diffDays = Math.round((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
        const dueDateFormatted = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        let eventType: WhatsAppEventType | null = null;
        let cadenceStage: string | null = null;

        if (options?.forceAllUnpaid) {
          if (hasOverdue || diffDays < 0) {
            eventType = 'FEE_OVERDUE';
            cadenceStage = 'FORCE_OVERDUE';
          } else {
            eventType = 'FEE_DUE';
            cadenceStage = 'FORCE_DUE';
          }
        } else {
          // Strict Cadence Stages:
          if (diffDays === 30) {
            // T-30: 1-Month in advance courtesy reminder
            eventType = 'FEE_UPCOMING';
            cadenceStage = 'T_MINUS_30';
          } else if (diffDays === 5) {
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

        const baseBody = this.renderTemplate(template.body, {
          academy_name: upiDetails.academyName,
          student_name: student.name,
          parent_name: cleanParentName(student.parent_name, student.name),
          phone: recipientPhone,
          course_name: student.course || 'Athletics & Martial Arts',
          amount: pendingAmount.toString(),
          pending_amount: pendingAmount.toString(),
          due_date: dueDateFormatted,
          payment_link: '',
          upi_id: '',
          upi_payee_name: '',
          razorpay_payment_link: '',
          date: todayStr,
        });

        const messageBody = baseBody;

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

      // Enqueue batch with 3.0s - 4.2s anti-ban throttle
      const queuedItems = await queueService.enqueueBatchStaggered(eligibleItems, 3000);

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
  async triggerTeacherWelcomeAutomation(_params: {
    fullName: string;
    email: string;
    password?: string;
    phone: string;
  }) {
    // Disabled per user instruction: hold on all automatic teacher messages
    console.log('[WhatsAppAutomation] Teacher automatic notifications held/disabled.');
    return null;
  }

  // ============================================================================
  // MANUAL CUSTOM DISPATCH
  // ============================================================================
  async sendCustomMessage(dto: SendCustomMessageDTO) {
    const academyName = await this.getAcademyName();
    const formattedBody = await this.formatMessageWithOnboardingNote(dto.messageBody, dto.recipientPhone, academyName);

    const queued = await queueService.enqueueMessage({
      recipientPhone: dto.recipientPhone,
      messageBody: formattedBody,
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
      status: (processResult as any).status || queued.status,
      error_message: (processResult as any).reason || queued.failure_reason,
      sent_at: (processResult as any).status === 'SENT' ? new Date().toISOString() : queued.sent_at,
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
  async triggerBatchTeacherAssignedAutomation(_params: {
    teacherPhone: string;
    teacherName: string;
    batchName: string;
    subject?: string;
    scheduleDays?: string[];
    startTime?: string;
    endTime?: string;
  }) {
    // Disabled per user instruction
    return null;
  }

  async triggerBatchTeacherUnassignedAutomation(_params: {
    teacherPhone: string;
    teacherName: string;
    batchName: string;
  }) {
    // Disabled per user instruction
    return null;
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

    if (filters.status && filters.status !== 'QUEUED') {
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

    // Outbox history strictly reflects authentic dispatched records (SENT / FAILED) from whatsapp_messages
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
          certificateNumber: promData?.certificate_number || 'CERTIFIED',
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
        upiId: '',
        upiPayeeName: '',
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
    const feeInstruction = reportData.fees.pendingAmount > 0
      ? `\n\n*Pending Dues:* Rs. ${reportData.fees.pendingAmount}\n*Payment Instructions:* Kindly settle dues via Academy Cash / Counter or contact Sensei.`
      : '';
    const caption = `*Monthly Progress & Attendance Report: ${academyName}*\n\nDear Parent,\nPlease find attached the official monthly progress report for *${reportData.studentName}* for the month of *${reportData.fees.billingPeriod}*.\n\n*Attendance Rate:* ${reportData.attendance.attendanceRate}% (${reportData.attendance.presentCount}/${reportData.attendance.totalSessions} Sessions)\n*Fee Status:* ${feeStatus}${feeInstruction}\n\nPlease review the attached document for detailed session breakdown.\n\n- ${academyName} Administration`;

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

  /**
   * Dispatch Student Welcome Invite via WhatsApp with PWA Portal Link & Credentials
   */
  async triggerStudentInvite(studentId: string, customPin?: string) {
    const { studentPortalService } = await import('../studentPortal.service.js');
    const authInfo = await studentPortalService.ensureStudentUser(studentId, customPin);

    const { data: student } = await this.supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const rawPhone = student.parent_whatsapp || student.student_mobile || '';
    const recipientPhone = normalizePhoneNumber(rawPhone) || rawPhone;
    if (!recipientPhone) {
      throw new AppError('Valid recipient mobile phone is required to send WhatsApp invite.', 400);
    }

    const academyName = await this.getAcademyName();

    const messageBody = [
      `🥋 *Welcome to ${academyName}, ${student.name}!*`,
      ``,
      `Your official student profile has been registered successfully.`,
      ``,
      `📱 *Account Details*:`,
      `• Registered Mobile: *${authInfo.phone}*`,
      `• Student ID / PIN: *${authInfo.password}*`,
      ``,
      `Daily attendance updates, training alerts, and fee receipts will be shared directly on this WhatsApp number.`,
      ``,
      `- ${academyName}`,
    ].join('\n');

    if (isBlockedOrDummyNumber(recipientPhone)) {
      console.warn(`[StudentInvite] Blocked delivery to dummy/test phone: ${recipientPhone}`);
      return { success: false, reason: 'Dummy or test phone number blocked' };
    }

    const provider = await whatsappProviderFactory.getProvider();
    const sendResult = await provider.sendMessage({
      to: recipientPhone,
      body: messageBody,
    });

    await this.supabase.from('whatsapp_messages').insert({
      student_id: student.id,
      recipient_phone: recipientPhone,
      message_body: messageBody,
      event_type: 'STUDENT_INVITE',
      status: sendResult.success ? 'SENT' : 'FAILED',
      provider_name: provider.name,
      provider_message_id: sendResult.messageId || null,
      error_message: sendResult.errorMessage || null,
      sent_at: sendResult.success ? new Date().toISOString() : null,
      metadata: {
        type: 'STUDENT_INVITE',
        studentId: student.id,
        phone: authInfo.phone,
      },
    });

    const { data: uData } = await this.supabase.auth.admin.getUserById(authInfo.authUserId);
    if (uData?.user) {
      await this.supabase.auth.admin.updateUserById(authInfo.authUserId, {
        user_metadata: {
          ...uData.user.user_metadata,
          portal_status: 'INVITED',
          invite_sent_at: new Date().toISOString(),
          reminder_count: 0,
        },
      });
    }

    return {
      success: sendResult.success,
      recipientPhone,
      studentName: student.name,
      authInfo,
      message: sendResult.success
        ? `WhatsApp invite dispatched to ${student.name} (${recipientPhone})!`
        : `Failed to dispatch WhatsApp message: ${sendResult.errorMessage}`,
    };
  }

  /**
   * Run automated onboarding chaser: scans invited students who haven't logged in yet
   */
  async triggerStudentOnboardingChaser() {
    const { data: usersData } = await this.supabase.auth.admin.listUsers();
    const academyName = await this.getAcademyName();
    const portalUrl = 'https://gurukul-sports-academy.pages.dev/login';

    const provider = await whatsappProviderFactory.getProvider();
    const reminded: any[] = [];
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (const u of usersData?.users || []) {
      const meta = u.user_metadata || {};
      if (meta.role !== ROLES.STUDENT) continue;
      if (meta.last_login_at) continue;
      if (!meta.invite_sent_at) continue;

      const inviteTime = new Date(meta.invite_sent_at).getTime();
      const lastReminderTime = meta.last_reminder_sent_at ? new Date(meta.last_reminder_sent_at).getTime() : inviteTime;
      const reminderCount = Number(meta.reminder_count || 0);

      if (reminderCount >= 3) continue;
      if (now - lastReminderTime < ONE_DAY_MS) continue;

      const phone = meta.phone;
      const studentName = meta.student_name || 'Student';
      const studentId = meta.student_id;
      if (!phone) continue;

      const recipientPhone = normalizePhoneNumber(phone) || phone;
      const pin = meta.initial_pin || `Gurukul@${phone.slice(-4)}`;
      const autoLoginLink = `${portalUrl}?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}&autologin=1`;

      const reminderBody = [
        `🥋 *Reminder from ${academyName}*`,
        ``,
        `Hi ${studentName}, your official Student Mobile App is ready!`,
        ``,
        `🚀 *Direct 1-Tap Auto-Login Link*:`,
        `${autoLoginLink}`,
        `_(Tap to login automatically without typing password!)_`,
        ``,
        `📱 *Login Mobile*: *${phone}*`,
        `🔑 *Password*: *${pin}*`,
        ``,
        `📲 Open the app to view your class schedule, monthly attendance, and belt progress!`,
        ``,
        `- ${academyName}`,
      ].join('\n');

      if (isBlockedOrDummyNumber(recipientPhone)) {
        console.warn(`[StudentReminder] Blocked delivery to dummy/test phone: ${recipientPhone}`);
        continue;
      }

      const sendResult = await provider.sendMessage({
        to: recipientPhone,
        body: reminderBody,
      });

      await this.supabase.from('whatsapp_messages').insert({
        student_id: studentId || null,
        recipient_phone: recipientPhone,
        message_body: reminderBody,
        event_type: 'STUDENT_REMINDER',
        status: sendResult.success ? 'SENT' : 'FAILED',
        provider_name: provider.name,
        provider_message_id: sendResult.messageId || null,
        sent_at: sendResult.success ? new Date().toISOString() : null,
      });

      if (sendResult.success) {
        await this.supabase.auth.admin.updateUserById(u.id, {
          user_metadata: {
            ...meta,
            reminder_count: reminderCount + 1,
            last_reminder_sent_at: new Date().toISOString(),
          },
        });
        reminded.push({ studentName, phone: recipientPhone, reminderCount: reminderCount + 1 });
      }
    }

    return {
      success: true,
      remindedCount: reminded.length,
      reminded,
    };
  }
}

export const automationService = new WhatsAppAutomationService();

