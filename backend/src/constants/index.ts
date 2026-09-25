export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  DEMO_ADMIN: 'DEMO_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export const FEE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  PARTIAL: 'PARTIAL',
} as const;

export type FeeStatus = (typeof FEE_STATUS)[keyof typeof FEE_STATUS];

export const PAYMENT_PROVIDER = {
  RAZORPAY: 'RAZORPAY',
  MANUAL: 'MANUAL',
  MOCK: 'MOCK',
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

export const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const WHATSAPP_MESSAGE_STATUS = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  MOCK: 'MOCK',
} as const;

export type WhatsAppMessageStatus = (typeof WHATSAPP_MESSAGE_STATUS)[keyof typeof WHATSAPP_MESSAGE_STATUS];

export const AUTOMATION_EVENTS = {
  ATTENDANCE_ABSENT: 'ATTENDANCE_ABSENT',
  FEE_UPCOMING: 'FEE_UPCOMING',
  FEE_DUE: 'FEE_DUE',
  FEE_OVERDUE: 'FEE_OVERDUE',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
} as const;

export type AutomationEvent = (typeof AUTOMATION_EVENTS)[keyof typeof AUTOMATION_EVENTS];
