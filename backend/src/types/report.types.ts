import { z } from 'zod';

// ============================================================================
// REPORTS FILTER SCHEMAS
// ============================================================================

export const attendanceReportFilterSchema = z.object({
  batchId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  studentId: z.string().uuid().optional(),
});

export type AttendanceReportFilterQuery = z.infer<typeof attendanceReportFilterSchema>;

export const feesReportFilterSchema = z.object({
  batchId: z.string().uuid().optional(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'PARTIAL']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type FeesReportFilterQuery = z.infer<typeof feesReportFilterSchema>;

export const paymentsReportFilterSchema = z.object({
  provider: z.enum(['RAZORPAY', 'MANUAL', 'MOCK']).optional(),
  status: z.enum(['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type PaymentsReportFilterQuery = z.infer<typeof paymentsReportFilterSchema>;

// ============================================================================
// ANNOUNCEMENTS SCHEMAS
// ============================================================================

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message cannot exceed 2000 characters'),
  batchIds: z.array(z.string().uuid('Valid batch ID is required')).min(1, 'At least one target batch must be selected'),
});

export type CreateAnnouncementDTO = z.infer<typeof createAnnouncementSchema>;

// ============================================================================
// REPORT RESPONSE TYPES
// ============================================================================

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
  records: any[];
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
  records: any[];
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
  records: any[];
}
