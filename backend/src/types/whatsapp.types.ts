import { z } from 'zod';

export const WHATSAPP_EVENT_TYPES = [
  'ATTENDANCE_ABSENT',
  'ATTENDANCE_CORRECTION',
  'PAYMENT_SUCCESS',
  'FEE_DUE',
  'FEE_OVERDUE',
  'FEE_UPCOMING',
  'ANNOUNCEMENT',
  'CUSTOM_NOTIFICATION',
] as const;
export type WhatsAppEventType = typeof WHATSAPP_EVENT_TYPES[number];

export const WHATSAPP_MESSAGE_STATUSES = [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'MOCK',
] as const;
export type WhatsAppMessageStatus = typeof WHATSAPP_MESSAGE_STATUSES[number];

export const WHATSAPP_QUEUE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED',
] as const;
export type WhatsAppQueueStatus = typeof WHATSAPP_QUEUE_STATUSES[number];

export const WHATSAPP_DEVICE_STATUSES = [
  'NOT_CONFIGURED',
  'QR_READY',
  'DISCONNECTED',
  'CONNECTING',
  'CONNECTED',
  'LOGGED_OUT',
  'ERROR',
] as const;
export type WhatsAppDeviceStatusEnum = typeof WHATSAPP_DEVICE_STATUSES[number];

export const WHATSAPP_PROVIDER_TYPES = [
  'mock',
  'prototype_linked_device',
  'meta',
  'openwa',
] as const;
export type WhatsAppProviderType = typeof WHATSAPP_PROVIDER_TYPES[number];

export const ALLOWED_TEMPLATE_VARIABLES = [
  '{{student_name}}',
  '{{phone}}',
  '{{course_name}}',
  '{{batch_name}}',
  '{{pending_amount}}',
  '{{razorpay_payment_link}}',
  '{{academy_name}}',
  '{{staff_name}}',
  '{{followup_date}}',
  '{{parent_name}}',
  '{{amount}}',
  '{{due_date}}',
  '{{payment_link}}',
  '{{date}}',
  '{{receipt_number}}',
] as const;

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Template name must be at least 2 characters'),
  eventType: z.enum(WHATSAPP_EVENT_TYPES),
  body: z.string().trim().min(5, 'Template body must be at least 5 characters'),
  active: z.boolean().default(true),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Template name must be at least 2 characters').optional(),
  eventType: z.enum(WHATSAPP_EVENT_TYPES).optional(),
  body: z.string().trim().min(5, 'Template body must be at least 5 characters').optional(),
  active: z.boolean().optional(),
});

// Custom send & trigger schemas
export const sendCustomMessageSchema = z.object({
  recipientPhone: z.string().trim().min(8, 'Valid recipient phone number is required'),
  messageBody: z.string().trim().min(2, 'Message body is required'),
  studentId: z.string().uuid('Invalid student ID format').optional(),
  templateId: z.string().uuid('Invalid template ID format').optional(),
  eventType: z.string().default('CUSTOM_NOTIFICATION'),
  scheduledAt: z.string().datetime().optional(),
});

export const triggerFeeReminderSchema = z.object({
  studentFeeId: z.string().uuid('Invalid student fee ID format'),
  studentId: z.string().uuid('Invalid student ID format').optional(),
  eventType: z.enum(['FEE_DUE', 'FEE_OVERDUE', 'FEE_UPCOMING']).optional(),
});

// Settings & controls schemas
export const updateWhatsAppSettingsSchema = z.object({
  globalAutomationEnabled: z.boolean().optional(),
  emergencyStop: z.boolean().optional(),
  dailyLimit: z.number().int().min(1, 'Daily limit must be at least 1').max(1000, 'Daily limit capped at 1000').optional(),
  providerType: z.enum(WHATSAPP_PROVIDER_TYPES).optional(),
});

export const toggleEmergencyStopSchema = z.object({
  emergencyStop: z.boolean(),
});

export const toggleOptInSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format').optional(),
  phoneNumber: z.string().min(8, 'Valid phone number required').optional(),
  optIn: z.boolean(),
});

export const processQueueSchema = z.object({
  batchSize: z.number().int().min(1).max(50).default(5),
});

export type CreateTemplateDTO = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateDTO = z.infer<typeof updateTemplateSchema>;
export type SendCustomMessageDTO = z.infer<typeof sendCustomMessageSchema>;
export type TriggerFeeReminderDTO = z.infer<typeof triggerFeeReminderSchema>;
export type UpdateWhatsAppSettingsDTO = z.infer<typeof updateWhatsAppSettingsSchema>;
export type ToggleEmergencyStopDTO = z.infer<typeof toggleEmergencyStopSchema>;
export type ToggleOptInDTO = z.infer<typeof toggleOptInSchema>;
export type ProcessQueueDTO = z.infer<typeof processQueueSchema>;

export interface MessageFilterQuery {
  status?: WhatsAppMessageStatus;
  eventType?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

export interface QueueFilterQuery {
  status?: WhatsAppQueueStatus;
  recipientPhone?: string;
  studentId?: string;
  eventType?: string;
  limit?: number;
}

export interface WhatsAppQueueItem {
  id: string;
  recipient_phone: string;
  student_id: string | null;
  template_id: string | null;
  event_type: string;
  message_body: string;
  scheduled_at: string;
  status: WhatsAppQueueStatus;
  attempts: number;
  max_attempts: number;
  sent_at: string | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  provider_message_id: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    name: string;
    course?: string;
  } | null;
}

export interface WhatsAppSettings {
  id: string;
  global_automation_enabled: boolean;
  emergency_stop: boolean;
  daily_limit: number;
  provider_type: WhatsAppProviderType;
  device_phone_number: string | null;
  device_status: WhatsAppDeviceStatusEnum;
  last_connected_at: string | null;
  last_heartbeat_at: string | null;
  session_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TodayStats {
  sent: number;
  pending: number;
  processing: number;
  failed: number;
  dailyLimit: number;
  remainingDailyLimit: number;
}
