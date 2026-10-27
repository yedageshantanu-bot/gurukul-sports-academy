import { z } from 'zod';

// ==========================================
// TEACHER TYPES & SCHEMAS
// ==========================================

export const createTeacherSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().or(z.literal('')),
  subject: z.string().min(1, 'Subject specialization is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export type CreateTeacherDTO = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().or(z.literal('')),
  subject: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type UpdateTeacherDTO = z.infer<typeof updateTeacherSchema>;

// ==========================================
// STUDENT TYPES & SCHEMAS
// ==========================================

export const createStudentSchema = z.object({
  name: z.string().min(2, 'Student name is required'),
  parentName: z.string().optional().or(z.literal('')),
  studentMobile: z.string().optional().or(z.literal('')),
  parentWhatsapp: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  course: z.string().optional().or(z.literal('')),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must be YYYY-MM-DD').optional(),
  monthlyFee: z.number().nonnegative('Monthly fee must be non-negative').default(0),
  feeDueDay: z.number().int().min(1).max(31).default(5),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  batchId: z.string().uuid().optional().or(z.literal('')),
  batchIds: z.array(z.string().uuid()).optional(),
  initialBatchIds: z.array(z.string().uuid()).optional(),
  whatsappOptIn: z.boolean().default(true).optional(),
  backfillPastFees: z.boolean().default(false).optional(),
  pastFeesStatus: z.enum(['PAID', 'PENDING']).default('PAID').optional(),
  initialPaymentAmount: z.number().nonnegative().optional().default(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'ONLINE', 'BANK_TRANSFER']).default('CASH').optional(),
  paymentNotes: z.string().optional().or(z.literal('')),
  sportDiscipline: z.string().optional(),
  initialBeltRank: z.string().optional().or(z.literal('')),
  sports: z.array(z.object({
    disciplineCode: z.string(),
    rankName: z.string().optional(),
  })).optional(),
  feeFrequency: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY').optional(),
  paidUpToMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal('')),
  feePaymentType: z.enum(['PAID_UP_TO', 'YEARLY_PAID', 'YEARLY_PARTIAL', 'FRESH_TODAY', 'UNPAID_PENDING']).optional(),
  nextInstallmentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  installments: z.array(z.object({
    amount: z.number().nonnegative(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional(),
  })).optional(),
});

export type CreateStudentDTO = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  name: z.string().min(2).optional(),
  parentName: z.string().optional().or(z.literal('')),
  studentMobile: z.string().optional().or(z.literal('')),
  parentWhatsapp: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  course: z.string().optional().or(z.literal('')),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).nullable(),
  monthlyFee: z.number().nonnegative().optional(),
  feeDueDay: z.number().int().min(1).max(31).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  batchId: z.string().uuid().optional().or(z.literal('')),
  batchIds: z.array(z.string().uuid()).optional(),
  initialBatchIds: z.array(z.string().uuid()).optional(),
  whatsappOptIn: z.boolean().optional(),
  sportDiscipline: z.string().optional(),
  initialBeltRank: z.string().optional().or(z.literal('')),
  sports: z.array(z.object({
    disciplineCode: z.string(),
    rankName: z.string().optional(),
  })).optional(),
});

export type UpdateStudentDTO = z.infer<typeof updateStudentSchema>;

// ==========================================
// BATCH TYPES & SCHEMAS
// ==========================================

export const createBatchSchema = z.object({
  name: z.string().min(2, 'Batch name is required'),
  subject: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  monthlyFee: z.number().nonnegative('Monthly fee must be non-negative').default(0),
  scheduleDays: z.array(z.string()).default([]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Start time must be HH:MM or HH:MM:SS').optional().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'End time must be HH:MM or HH:MM:SS').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  teacherIds: z.array(z.string().uuid()).optional(),
});

export type CreateBatchDTO = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = z.object({
  name: z.string().min(2).optional(),
  subject: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  monthlyFee: z.number().nonnegative('Monthly fee must be non-negative').optional(),
  scheduleDays: z.array(z.string()).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  teacherIds: z.array(z.string().uuid()).optional(),
});

export type UpdateBatchDTO = z.infer<typeof updateBatchSchema>;

// ==========================================
// ASSIGNMENT DTOs
// ==========================================

export const assignTeacherSchema = z.object({
  teacherId: z.string().uuid('Valid teacher ID is required'),
});

export const assignStudentSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
});
