import crypto from 'crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  PaymentProvider,
  CreateOrderParams,
  OrderResult,
  VerifyPaymentParams,
  VerificationResult,
  WebhookEventResult,
} from './paymentProvider.interface.js';

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'RAZORPAY' as const;

  private get keyId(): string {
    return env.RAZORPAY_KEY_ID || '';
  }

  private get keySecret(): string {
    return env.RAZORPAY_KEY_SECRET || '';
  }

  private get webhookSecret(): string {
    return env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Razorpay credentials are not configured on this server. Please use MOCK provider or configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    // Amount in paise for Razorpay INR
    const amountInPaise = Math.round(params.amount * 100);

    // Call Razorpay Orders API
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes || {},
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new AppError(
        `Failed to create Razorpay order: ${JSON.stringify(errData)}`,
        502,
        'PAYMENT_GATEWAY_ERROR'
      );
    }

    const orderData = (await response.json()) as { id: string; amount: number; currency: string };

    return {
      orderId: orderData.id,
      amount: orderData.amount / 100,
      currency: orderData.currency,
      status: 'CREATED',
      provider: 'RAZORPAY',
      keyId: this.keyId,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerificationResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Razorpay credentials are not configured on this server.',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    const { orderId, paymentId, signature } = params;

    if (!signature) {
      return {
        success: false,
        paymentId,
        orderId,
        errorMessage: 'Missing Razorpay signature',
      };
    }

    // Verify HMAC SHA256: hmac_sha256(order_id + "|" + razorpay_payment_id, secret) === signature
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );

    if (!isValid) {
      return {
        success: false,
        paymentId,
        orderId,
        errorMessage: 'Invalid payment signature from provider',
      };
    }

    return {
      success: true,
      paymentId,
      orderId,
      paidAt: new Date(),
      rawResponse: {
        provider: 'RAZORPAY',
        verified: true,
      },
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  processWebhookEvent(payload: Record<string, unknown>): WebhookEventResult {
    const event = (payload.event as string) || '';
    const payloadObj = (payload.payload as Record<string, unknown>) || {};
    const paymentObj = (payloadObj.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;

    const paymentId = (paymentObj?.id as string) || '';
    const orderId = (paymentObj?.order_id as string) || '';
    const amountInPaise = Number(paymentObj?.amount || 0);

    if (event === 'payment.captured' || event === 'order.paid') {
      return {
        eventType: event,
        paymentId,
        orderId,
        status: 'SUCCESS',
        amount: amountInPaise / 100,
        payload,
      };
    }

    if (event === 'payment.failed') {
      return {
        eventType: event,
        paymentId,
        orderId,
        status: 'FAILED',
        amount: amountInPaise / 100,
        payload,
      };
    }

    return {
      eventType: event,
      paymentId,
      orderId,
      status: 'IGNORED',
      amount: amountInPaise / 100,
      payload,
    };
  }
}
