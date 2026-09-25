export interface SendMessageParams {
  to: string; // recipient phone number
  body: string;
  templateName?: string;
  variables?: Record<string, string>;
}

export interface SendMessageResult {
  success: boolean;
  provider: 'MOCK' | 'META' | 'PROTOTYPE_LINKED_DEVICE' | string;
  messageId?: string;
  status: 'MOCK' | 'SENT' | 'FAILED';
  errorMessage?: string;
}

export interface WhatsAppDeviceStatus {
  status: 'NOT_CONFIGURED' | 'QR_READY' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  phoneNumber?: string;
  lastConnectedAt?: string;
  lastHeartbeatAt?: string;
  qrCode?: string;
  sessionStatus?: string;
  providerName: string;
  isConfigured: boolean;
  details?: string;
}

export interface WhatsAppSender {
  readonly name: string;
  getStatus(): Promise<WhatsAppDeviceStatus>;
  connect(): Promise<{ success: boolean; message: string; qrCode?: string; status: WhatsAppDeviceStatus }>;
  disconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }>;
  reconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }>;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;
}

// Backwards-compatible alias for existing service usage
export type WhatsAppProvider = WhatsAppSender;
