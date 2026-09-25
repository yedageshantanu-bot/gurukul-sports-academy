export interface CreateOrderParams {
  amount: number; // in standard currency units (e.g. INR)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface OrderResult {
  orderId: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PENDING';
  provider: 'RAZORPAY' | 'MOCK' | 'MANUAL';
  keyId?: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature?: string;
}

export interface VerificationResult {
  success: boolean;
  paymentId: string;
  orderId: string;
  amount?: number;
  paidAt?: Date;
  rawResponse?: Record<string, unknown>;
  errorMessage?: string;
}

export interface WebhookEventResult {
  eventType: string;
  paymentId?: string;
  orderId?: string;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'IGNORED';
  amount?: number;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: 'RAZORPAY' | 'MOCK' | 'MANUAL';
  createOrder(params: CreateOrderParams): Promise<OrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerificationResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
  processWebhookEvent(payload: Record<string, unknown>): WebhookEventResult;
}
