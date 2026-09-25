import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { paymentProviderFactory } from './payments/paymentProvider.factory.js';
import { automationService } from './whatsapp/automation.service.js';
import {
  CreatePaymentOrderDTO,
  VerifyPaymentDTO,
  RecordManualPaymentDTO,
  PaymentFilterQuery,
} from '../types/fee.types.js';

export class PaymentService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  // ============================================================================
  // CREATE PAYMENT ORDER
  // ============================================================================
  async createPaymentOrder(dto: CreatePaymentOrderDTO) {
    // 1. Verify student exists
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .select('id, name, status')
      .eq('id', dto.studentId)
      .single();

    if (studentError || !student) {
      throw new AppError('Student not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // 2. Validate student fee relationship server-side if provided
    let feeBillingPeriod = 'general';
    if (dto.studentFeeId) {
      const { data: studentFee, error: feeError } = await this.supabase
        .from('student_fees')
        .select('id, student_id, billing_period, amount_due, amount_paid')
        .eq('id', dto.studentFeeId)
        .single();

      if (feeError || !studentFee) {
        throw new AppError('Student fee record not found', 404, 'RESOURCE_NOT_FOUND');
      }

      if (studentFee.student_id !== dto.studentId) {
        throw new AppError(
          'Student fee record does not belong to the specified student',
          400,
          'INVALID_FEE_STUDENT_RELATIONSHIP'
        );
      }

      feeBillingPeriod = studentFee.billing_period;
    }

    // 3. Resolve provider
    const providerType = dto.provider || 'MOCK';
    const provider = paymentProviderFactory.getProvider(providerType);

    // 4. Create order via provider abstraction
    const receiptRef = `rcpt_${Date.now()}`;
    const orderResult = await provider.createOrder({
      amount: dto.amount,
      receipt: receiptRef,
      notes: {
        studentId: dto.studentId,
        studentFeeId: dto.studentFeeId || '',
        billingPeriod: feeBillingPeriod,
      },
    });

    // 5. Store payment record with status CREATED
    const { data: paymentRecord, error: insertError } = await this.supabase
      .from('payments')
      .insert({
        student_id: dto.studentId,
        student_fee_id: dto.studentFeeId ?? null,
        amount: dto.amount,
        provider: provider.name,
        provider_order_id: orderResult.orderId,
        status: 'CREATED',
        metadata: {
          currency: orderResult.currency,
          receiptRef,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PaymentService.createPaymentOrder] Error:', insertError);
      throw new AppError(`Failed to initialize payment record: ${insertError.message}`, 500);
    }

    return {
      paymentRecordId: paymentRecord.id,
      orderId: orderResult.orderId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      provider: provider.name,
      keyId: orderResult.keyId,
    };
  }

  // ============================================================================
  // VERIFY PAYMENT (SERVER-SIDE CONFIRMATION)
  // ============================================================================
  async verifyPayment(dto: VerifyPaymentDTO) {
    // 1. Fetch payment record
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', dto.paymentRecordId)
      .single();

    if (paymentError || !payment) {
      throw new AppError('Payment record not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // 2. IDEMPOTENCY CHECK: If already successful, return existing state safely
    if (payment.status === 'SUCCESS') {
      const { data: existingReceipt } = await this.supabase
        .from('receipts')
        .select('*')
        .eq('payment_id', payment.id)
        .maybeSingle();

      return {
        success: true,
        message: 'Payment already verified and completed',
        isDuplicate: true,
        payment,
        receipt: existingReceipt,
      };
    }

    // 3. Resolve provider and verify payment server-side
    const provider = paymentProviderFactory.getProvider(dto.provider || payment.provider);
    const verificationResult = await provider.verifyPayment({
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      signature: dto.signature,
    });

    // 4. Handle verification failure
    if (!verificationResult.success) {
      await this.supabase
        .from('payments')
        .update({
          status: 'FAILED',
          provider_payment_id: dto.paymentId,
          updated_at: new Date().toISOString(),
          metadata: {
            ...payment.metadata,
            failureReason: verificationResult.errorMessage || 'Verification rejected',
          },
        })
        .eq('id', payment.id);

      throw new AppError(
        verificationResult.errorMessage || 'Payment verification failed',
        400,
        'PAYMENT_VERIFICATION_FAILED'
      );
    }

    // 5. Handle verification success
    const paidAt = (verificationResult.paidAt || new Date()).toISOString();

    const { data: updatedPayment, error: updateError } = await this.supabase
      .from('payments')
      .update({
        status: 'SUCCESS',
        provider_payment_id: dto.paymentId,
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          verification: verificationResult.rawResponse || {},
        },
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError) {
      console.error('[PaymentService.verifyPayment] Error updating payment:', updateError);
      throw new AppError(`Failed to update payment status: ${updateError.message}`, 500);
    }

    // 6. Update student fee balance if linked
    if (payment.student_fee_id) {
      await this.creditStudentFee(payment.student_fee_id, Number(payment.amount));
    }

    // 7. Issue official receipt
    const receipt = await this.generateReceipt(payment.id, payment.student_id, Number(payment.amount));

    // 8. Trigger WhatsApp payment confirmation asynchronously (non-blocking)
    automationService
      .triggerPaymentSuccessAutomation({
        studentId: payment.student_id,
        amount: Number(payment.amount),
        receiptNumber: receipt?.receipt_number,
        studentFeeId: payment.student_fee_id ?? undefined,
      })
      .catch((e) => console.warn('[PaymentService] WhatsApp payment alert warning:', e.message));

    return {
      success: true,
      isDuplicate: false,
      payment: updatedPayment,
      receipt,
    };
  }

  // ============================================================================
  // RECORD MANUAL PAYMENT (CASH / CHEQUE / UPI)
  // ============================================================================
  async recordManualPayment(dto: RecordManualPaymentDTO) {
    // 1. Verify student exists
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .select('id, name, status')
      .eq('id', dto.studentId)
      .single();

    if (studentError || !student) {
      throw new AppError('Student not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // 2. Validate student fee relationship server-side if provided
    if (dto.studentFeeId) {
      const { data: studentFee, error: feeError } = await this.supabase
        .from('student_fees')
        .select('id, student_id')
        .eq('id', dto.studentFeeId)
        .single();

      if (feeError || !studentFee) {
        throw new AppError('Student fee record not found', 404, 'RESOURCE_NOT_FOUND');
      }

      if (studentFee.student_id !== dto.studentId) {
        throw new AppError(
          'Student fee record does not belong to the specified student',
          400,
          'INVALID_FEE_STUDENT_RELATIONSHIP'
        );
      }
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt).toISOString() : new Date().toISOString();

    // 3. Insert payment record with SUCCESS status
    const { data: payment, error: insertError } = await this.supabase
      .from('payments')
      .insert({
        student_id: dto.studentId,
        student_fee_id: dto.studentFeeId ?? null,
        amount: dto.amount,
        provider: 'MANUAL',
        provider_payment_id: `man_pay_${Date.now()}`,
        status: 'SUCCESS',
        paid_at: paidAt,
        metadata: {
          paymentMethod: dto.paymentMethod || 'CASH',
          notes: dto.notes || '',
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PaymentService.recordManualPayment] Error:', insertError);
      throw new AppError(`Failed to record manual payment: ${insertError.message}`, 500);
    }

    // 4. Update student fee balance if linked
    if (dto.studentFeeId) {
      await this.creditStudentFee(dto.studentFeeId, dto.amount);
    }

    // 5. Generate receipt
    const receipt = await this.generateReceipt(payment.id, dto.studentId, dto.amount);

    // 6. Trigger WhatsApp payment confirmation asynchronously (non-blocking)
    automationService
      .triggerPaymentSuccessAutomation({
        studentId: dto.studentId,
        amount: dto.amount,
        receiptNumber: receipt?.receipt_number,
        studentFeeId: dto.studentFeeId ?? undefined,
      })
      .catch((e) => console.warn('[PaymentService] WhatsApp payment alert warning:', e.message));

    return {
      payment,
      receipt,
    };
  }

  // ============================================================================
  // WEBHOOK HANDLER (IDEMPOTENT SERVER-TO-SERVER)
  // ============================================================================
  async handleWebhook(rawBody: string | Buffer, signature: string, payload: Record<string, unknown>) {
    const provider = paymentProviderFactory.getProvider('RAZORPAY');

    const isValid = provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const eventResult = provider.processWebhookEvent(payload);

    if (eventResult.status === 'SUCCESS' && eventResult.orderId) {
      // Find payment record by provider_order_id
      const { data: payment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('provider_order_id', eventResult.orderId)
        .maybeSingle();

      if (payment && payment.status !== 'SUCCESS') {
        await this.verifyPayment({
          paymentRecordId: payment.id,
          orderId: eventResult.orderId,
          paymentId: eventResult.paymentId || `wh_pay_${Date.now()}`,
          provider: 'RAZORPAY',
        });
      }
    }

    return { received: true, status: eventResult.status };
  }

  // ============================================================================
  // LIST & GET PAYMENTS
  // ============================================================================
  async listPayments(filters: PaymentFilterQuery = {}) {
    let query = this.supabase
      .from('payments')
      .select(`
        *,
        student:students(id, name, course, student_mobile),
        student_fee:student_fees(id, billing_period, amount_due),
        receipts:receipts(*)
      `)
      .order('created_at', { ascending: false });

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.provider) {
      query = query.eq('provider', filters.provider);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[PaymentService.listPayments] Error:', error);
      throw new AppError(`Failed to list payments: ${error.message}`, 500);
    }

    return ((data || []) as Array<Record<string, any>>).map((p) => ({
      ...p,
      receipt: Array.isArray(p.receipts) && p.receipts.length > 0 ? p.receipts[0] : null,
    }));
  }

  async getPaymentById(id: string) {
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        student:students(id, name, course, student_mobile),
        student_fee:student_fees(id, billing_period, amount_due),
        receipts:receipts(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Payment record not found', 404, 'RESOURCE_NOT_FOUND');
    }

    return {
      ...data,
      receipt: Array.isArray(data.receipts) && data.receipts.length > 0 ? data.receipts[0] : null,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async creditStudentFee(studentFeeId: string, amount: number) {
    const { data: currentFee, error: fetchError } = await this.supabase
      .from('student_fees')
      .select('id, amount_due, amount_paid, due_date')
      .eq('id', studentFeeId)
      .single();

    if (fetchError || !currentFee) return;

    const newAmountPaid = Number(currentFee.amount_paid) + amount;
    const amountDue = Number(currentFee.amount_due);

    let newStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' = 'PENDING';
    if (newAmountPaid >= amountDue) {
      newStatus = 'PAID';
    } else if (newAmountPaid > 0) {
      newStatus = 'PARTIAL';
    } else if (new Date(currentFee.due_date) < new Date()) {
      newStatus = 'OVERDUE';
    }

    await this.supabase
      .from('student_fees')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentFeeId);
  }

  private async generateReceipt(paymentId: string, studentId: string, amount: number) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const random = Math.floor(10000 + Math.random() * 90000);
    const receiptNumber = `REC-${yearMonth}-${random}`;

    const { data, error } = await this.supabase
      .from('receipts')
      .insert({
        receipt_number: receiptNumber,
        payment_id: paymentId,
        student_id: studentId,
        amount,
        issued_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn('[PaymentService.generateReceipt] Failed to insert receipt:', error.message);
      return null;
    }

    return data;
  }
}

export const paymentService = new PaymentService();
