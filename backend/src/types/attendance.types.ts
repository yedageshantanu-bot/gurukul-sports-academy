import { z } from 'zod';

export const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT']);

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const attendanceRecordItemSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  status: attendanceStatusSchema,
});

export const bulkAttendanceSchema = z.object({
  batchId: z.string().uuid('Valid batch ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  records: z.array(attendanceRecordItemSchema).min(1, 'At least one student attendance record is required'),
  teacherId: z.string().uuid('Valid teacher ID is required').optional(),
});

export type BulkAttendanceDTO = z.infer<typeof bulkAttendanceSchema>;

export const updateAttendanceSchema = z.object({
  status: attendanceStatusSchema,
});

export type UpdateAttendanceDTO = z.infer<typeof updateAttendanceSchema>;

export interface AttendanceSheetStudent {
  studentId: string;
  name: string;
  studentMobile?: string;
  parentWhatsapp?: string;
  status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
  attendanceId?: string;
  correctedAt?: string | null;
  correctedBy?: string | null;
  feeOverdue?: { isOverdue: boolean; daysOverdue: number; pendingAmount: number } | null;
}
