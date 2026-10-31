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
  batchIds: z.array(z.string().uuid('Valid batch ID is required')).default([]),
  tournamentIds: z.array(z.string().uuid()).optional(),
  teamCodes: z.array(z.string()).optional(),
  teamIds: z.array(z.string()).optional(),
  teamMemberIds: z.array(z.string()).optional(),
  includeSelf: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) =>
    (Array.isArray(data.batchIds) && data.batchIds.length > 0) ||
    (Array.isArray(data.tournamentIds) && data.tournamentIds.length > 0) ||
    (Array.isArray(data.metadata?.tournamentIds) && data.metadata.tournamentIds.length > 0) ||
    (Array.isArray(data.teamCodes) && data.teamCodes.length > 0) ||
    (Array.isArray(data.metadata?.teamCodes) && data.metadata.teamCodes.length > 0) ||
    (Array.isArray(data.teamIds) && data.teamIds.length > 0) ||
    (Array.isArray(data.metadata?.teamIds) && data.metadata.teamIds.length > 0) ||
    (Array.isArray(data.teamMemberIds) && data.teamMemberIds.length > 0) ||
    (Array.isArray(data.metadata?.teamMemberIds) && data.metadata.teamMemberIds.length > 0) ||
    data.includeSelf === true ||
    data.metadata?.includeSelf === true,
  {
    message: 'At least one target audience (batch, tournament squad, or team) must be selected',
    path: ['batchIds'],
  }
);

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
