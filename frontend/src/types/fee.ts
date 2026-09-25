export type FeeFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ANNUAL' | 'CUSTOM' | 'ONE_TIME';
export type StudentFeeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
export type PaymentProviderType = 'RAZORPAY' | 'MANUAL' | 'MOCK';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface FeePlan {
  id: string;
  name: string;
  amount: number;
  frequency: FeeFrequency;
  due_day?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentFee {
  id: string;
  student_id: string;
  fee_plan_id?: string | null;
  billing_period: string;
  amount_due: number;
  amount_paid: number;
  pending_amount: number;
  due_date: string;
  status: StudentFeeStatus;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    name: string;
    course?: string;
    student_mobile?: string;
    parent_name?: string;
    parent_whatsapp?: string;
  };
  fee_plan?: {
    id: string;
    name: string;
    frequency: string;
  };
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  amount: number;
  issued_at: string;
  pdf_url?: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  student_id: string;
  student_fee_id?: string | null;
  amount: number;
  provider: PaymentProviderType;
  provider_payment_id?: string | null;
  provider_order_id?: string | null;
  status: PaymentStatus;
  paid_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    name: string;
    course?: string;
    student_mobile?: string;
  };
  student_fee?: {
    id: string;
    billing_period: string;
    amount_due: number;
  };
  receipt?: Receipt | null;
}
