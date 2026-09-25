import {
  PaymentProvider,
  CreateOrderParams,
  OrderResult,
  VerifyPaymentParams,
  VerificationResult,
  WebhookEventResult,
} from './paymentProvider.interface.js';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    const orderId = `mock_ord_${timestamp}_${random}`;

    return {
      orderId,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'CREATED',
      provider: 'MOCK',
      keyId: 'mock_key_id_dev_only',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerificationResult> {
    const { orderId, paymentId, signature } = params;

    // Reject simulated failure signatures or payment IDs containing 'fail'
    if (paymentId.includes('fail') || signature === 'mock_fail_signature') {
      return {
        success: false,
        paymentId,
        orderId,
        errorMessage: 'Simulated payment verification failure (MOCK)',
      };
    }

    // In mock mode, a valid payment begins with mock_pay_ or pay_
    if (!paymentId || paymentId.trim().length < 5) {
      return {
        success: false,
        paymentId: paymentId || '',
        orderId,
        errorMessage: 'Invalid mock payment ID format',
      };
    }

    return {
      success: true,
      paymentId,
      orderId,
      paidAt: new Date(),
      rawResponse: {
        provider: 'MOCK',
        verified: true,
        method: 'mock_gateway',
        timestamp: new Date().toISOString(),
      },
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    // In mock mode, any signature matching 'mock_valid_signature' or truthy is accepted
    return signature === 'mock_valid_signature' || signature.startsWith('mock_sig_');
  }

  processWebhookEvent(payload: Record<string, unknown>): WebhookEventResult {
    const event = (payload.event as string) || 'payment.captured';
    const payment = (payload.payment as Record<string, unknown>) || {};
    const paymentId = (payment.id as string) || (payload.paymentId as string) || 'mock_pay_webhook';
    const orderId = (payment.order_id as string) || (payload.orderId as string) || 'mock_ord_webhook';
    const amount = Number(payment.amount || payload.amount || 0);

    if (event === 'payment.failed') {
      return {
        eventType: event,
        paymentId,
        orderId,
        status: 'FAILED',
        amount,
        payload,
      };
    }

    return {
      eventType: event,
      paymentId,
      orderId,
      status: 'SUCCESS',
      amount,
      payload,
    };
  }
}
