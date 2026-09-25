import { z } from 'zod';

export const FEE_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUAL', 'CUSTOM', 'ONE_TIME'] as const;
export type FeeFrequency = typeof FEE_FREQUENCIES[number];

export const STUDENT_FEE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'PARTIAL'] as const;
export type StudentFeeStatus = typeof STUDENT_FEE_STATUSES[number];

export const PAYMENT_PROVIDERS = ['RAZORPAY', 'MANUAL', 'MOCK'] as const;
export type PaymentProviderType = typeof PAYMENT_PROVIDERS[number];

export const PAYMENT_STATUSES = ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

// ==============================================================================
// FEE PLAN SCHEMAS
// ==============================================================================
export const createFeePlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters'),
  amount: z.number().positive('Amount must be greater than 0'),
  frequency: z.enum(FEE_FREQUENCIES).default('MONTHLY'),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().default(true),
});

export const updateFeePlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters').optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  frequency: z.enum(FEE_FREQUENCIES).optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateFeePlanDTO = z.infer<typeof createFeePlanSchema>;
export type UpdateFeePlanDTO = z.infer<typeof updateFeePlanSchema>;

// ==============================================================================
// STUDENT FEE SCHEMAS
// ==============================================================================
export const assignStudentFeeSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      ...val,
      studentId: val.studentId || val.student_id,
      feePlanId: val.feePlanId || val.fee_plan_id,
      billingPeriod: val.billingPeriod || val.billing_period,
      amountDue: val.amountDue !== undefined ? val.amountDue : val.amount_due,
      dueDate: val.dueDate || val.due_date,
      amountPaid: val.amountPaid !== undefined ? val.amountPaid : (val.amount_paid !== undefined ? val.amount_paid : 0),
    };
  }
  return val;
}, z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  feePlanId: z.string().uuid('Invalid fee plan ID format').nullable().optional(),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'Billing period must be formatted as YYYY-MM (e.g. 2026-09)'),
  amountDue: z.number().positive('Amount due must be greater than 0'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be formatted as YYYY-MM-DD'),
  amountPaid: z.number().min(0).default(0),
}));

export const updateStudentFeeSchema = z.object({
  amountDue: z.number().positive('Amount due must be greater than 0').optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be formatted as YYYY-MM-DD').optional(),
  status: z.enum(STUDENT_FEE_STATUSES).optional(),
});

export type AssignStudentFeeDTO = z.infer<typeof assignStudentFeeSchema>;
export type UpdateStudentFeeDTO = z.infer<typeof updateStudentFeeSchema>;

// ==============================================================================
// PAYMENT SCHEMAS
// ==============================================================================
export const createPaymentOrderSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      ...val,
      studentId: val.studentId || val.student_id,
      studentFeeId: val.studentFeeId || val.student_fee_id,
      amount: val.amount,
      provider: val.provider || 'MOCK',
    };
  }
  return val;
}, z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  studentFeeId: z.string().uuid('Invalid student fee ID format').nullable().optional(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  provider: z.enum(['RAZORPAY', 'MOCK']).default('MOCK'),
}));

export const verifyPaymentSchema = z.object({
  paymentRecordId: z.string().uuid('Invalid payment record ID format'),
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().optional(),
  provider: z.enum(['RAZORPAY', 'MOCK']).default('MOCK'),
});

export const recordManualPaymentSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      ...val,
      studentId: val.studentId || val.student_id,
      studentFeeId: val.studentFeeId || val.student_fee_id,
      amount: val.amount,
      paymentMethod: val.paymentMethod || val.payment_method || 'CASH',
      notes: val.notes,
      paidAt: val.paidAt || val.paid_at,
    };
  }
  return val;
}, z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  studentFeeId: z.string().uuid('Invalid student fee ID format').nullable().optional(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.string().default('CASH'),
  notes: z.string().optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be YYYY-MM-DD').optional(),
}));

export type CreatePaymentOrderDTO = z.infer<typeof createPaymentOrderSchema>;
export type VerifyPaymentDTO = z.infer<typeof verifyPaymentSchema>;
export type RecordManualPaymentDTO = z.infer<typeof recordManualPaymentSchema>;

// ==============================================================================
// QUERY FILTER SCHEMAS
// ==============================================================================
export interface StudentFeeFilterQuery {
  studentId?: string;
  status?: StudentFeeStatus;
  billingPeriod?: string;
  search?: string;
}

export interface PaymentFilterQuery {
  studentId?: string;
  status?: PaymentStatus;
  provider?: PaymentProviderType;
  startDate?: string;
  endDate?: string;
}
