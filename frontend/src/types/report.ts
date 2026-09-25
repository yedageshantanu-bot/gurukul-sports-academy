export interface AttendanceReportSummary {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  attendancePercentage: number;
  batchBreakdown: {
    batchId: string;
    batchName: string;
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
  }[];
  records: {
    id: string;
    attendance_date: string;
    status: 'PRESENT' | 'ABSENT';
    created_at: string;
    student?: {
      id: string;
      name: string;
      course?: string;
      student_mobile?: string;
      parent_whatsapp?: string;
    };
    batch?: {
      id: string;
      name: string;
      subject?: string;
    };
  }[];
}

export interface FeesReportSummary {
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  statusBreakdown: {
    status: string;
    count: number;
    amount: number;
  }[];
  records: {
    id: string;
    billing_period: string;
    amount_due: number;
    amount_paid: number;
    due_date: string;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
    student?: {
      id: string;
      name: string;
      course?: string;
      student_mobile?: string;
    };
    fee_plan?: {
      id: string;
      name: string;
      amount: number;
      frequency: string;
    };
  }[];
}

export interface PaymentsReportSummary {
  totalVolume: number;
  successfulCount: number;
  failedCount: number;
  providerBreakdown: {
    provider: string;
    volume: number;
    count: number;
  }[];
  records: {
    id: string;
    amount: number;
    provider: 'RAZORPAY' | 'MANUAL' | 'MOCK';
    provider_payment_id?: string;
    status: string;
    paid_at?: string;
    created_at: string;
    student?: {
      id: string;
      name: string;
      student_mobile?: string;
    };
    receipt?: {
      id: string;
      receipt_number: string;
    };
  }[];
}
