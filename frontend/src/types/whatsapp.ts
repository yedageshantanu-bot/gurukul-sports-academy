export type WhatsAppEventType =
  | 'ATTENDANCE_ABSENT'
  | 'PAYMENT_SUCCESS'
  | 'FEE_DUE'
  | 'FEE_OVERDUE'
  | 'FEE_UPCOMING'
  | 'ANNOUNCEMENT'
  | 'CUSTOM_NOTIFICATION';

export type WhatsAppMessageStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'MOCK';

export type WhatsAppQueueStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'MOCK';

export type WhatsAppDeviceStatusEnum =
  | 'NOT_CONFIGURED'
  | 'QR_READY'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LOGGED_OUT'
  | 'ERROR';

export type WhatsAppProviderType = 'mock' | 'prototype_linked_device' | 'meta';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  event_type: WhatsAppEventType;
  body: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  template_id?: string | null;
  student_id?: string | null;
  recipient_phone: string;
  event_type: string;
  message_body: string;
  provider_message_id?: string | null;
  status: WhatsAppMessageStatus;
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
  student?: {
    id: string;
    name: string;
    course?: string;
    parent_name?: string;
  } | null;
  template?: {
    id: string;
    name: string;
    event_type: string;
  } | null;
}

export interface WhatsAppQueueItem {
  id: string;
  recipient_phone: string;
  student_id?: string | null;
  template_id?: string | null;
  event_type: string;
  message_body: string;
  scheduled_at: string;
  status: WhatsAppQueueStatus;
  attempts: number;
  max_attempts: number;
  sent_at?: string | null;
  failure_reason?: string | null;
  idempotency_key?: string | null;
  provider_message_id?: string | null;
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
  device_phone_number?: string | null;
  device_status: WhatsAppDeviceStatusEnum;
  last_connected_at?: string | null;
  last_heartbeat_at?: string | null;
  session_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppDeviceStatus {
  status: WhatsAppDeviceStatusEnum;
  phoneNumber?: string;
  lastConnectedAt?: string;
  lastHeartbeatAt?: string;
  qrCode?: string;
  sessionStatus?: string;
  providerName: string;
  isConfigured: boolean;
  details?: string;
}

export interface TodayStats {
  sent: number;
  pending: number;
  processing: number;
  failed: number;
  dailyLimit: number;
  remainingDailyLimit: number;
}
