import { env } from '../../config/env.js';
import {
  WhatsAppSender,
  SendMessageParams,
  SendMessageResult,
  WhatsAppDeviceStatus,
} from './whatsappProvider.interface.js';

/**
 * OpenWaProvider
 * 
 * Official OpenWA REST API Gateway Provider.
 * Communicates directly with the OpenWA NestJS API running on http://127.0.0.1:2785.
 */
export class OpenWaProvider implements WhatsAppSender {
  readonly name = 'OPENWA' as const;
  private cachedSessionId: string | null = null;
  private cachedSessionInfo: any = null;
  private lastStatusResult: { data: WhatsAppDeviceStatus; timestamp: number } | null = null;
  private lastQrCode: string | null = null;

  private getBaseUrl(): string {
    return (env.OPENWA_API_URL || process.env.OPENWA_API_URL || env.WHATSAPP_LINKED_DEVICE_URL || 'https://gurukul-openwa-bridge.onrender.com').replace(/\/+$/, '');
  }

  private getApiKey(): string {
    return (
      env.OPENWA_API_KEY ||
      process.env.OPENWA_API_KEY ||
      env.WHATSAPP_LINKED_DEVICE_TOKEN ||
      'gurukul_sports_openwa_bridge_secret_key_prod_2026'
    );
  }

  private getHeaders(): Record<string, string> {
    const key = this.getApiKey();
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': key,
      Authorization: `Bearer ${key}`,
    };
  }

  private formatChatId(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = `91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = `91${digits.slice(1)}`;
    }
    return digits.includes('@') ? digits : `${digits}@c.us`;
  }

  isConfigured(): boolean {
    return Boolean(this.getBaseUrl() && this.getApiKey());
  }

  /**
   * Resolves or creates an active session in OpenWA
   */
  async getActiveSession(): Promise<{ id: string; name: string; phone?: string; status: string } | null> {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429) {
        console.warn('[OpenWA] Throttled (429) on /api/sessions, using cached session:', this.cachedSessionId);
        if (this.cachedSessionInfo) {
          return this.cachedSessionInfo;
        }
      }

      if (!res.ok) {
        return this.cachedSessionInfo || null;
      }

      const sessions = (await res.json()) as any[];
      if (Array.isArray(sessions) && sessions.length > 0) {
        const readySession = sessions.find((s) => s.status === 'ready') || sessions[0];
        this.cachedSessionId = readySession.id;
        this.cachedSessionInfo = readySession;
        return readySession;
      }

      // Auto-create session if none exists
      const createRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name: 'gurukul-session' }),
        signal: AbortSignal.timeout(15000),
      });

      if (createRes.ok) {
        const created = (await createRes.json()) as any;
        const sessionId = created.id || created.sessionId;
        this.cachedSessionId = sessionId;
        this.cachedSessionInfo = created;
        try {
          await fetch(`${baseUrl}/api/sessions/${sessionId}/start`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(8000),
          });
        } catch {}
        return created;
      }

      return this.cachedSessionInfo || null;
    } catch (err: any) {
      console.warn('[OpenWA] Failed to query/create session in OpenWA:', err.message);
      return this.cachedSessionInfo || null;
    }
  }

  /**
   * Fetch QR code from OpenWA for a session
   */
  async getQrCode(sessionId: string): Promise<string | null> {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/qr`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429) {
        return this.lastQrCode;
      }

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.qrCode) {
          this.lastQrCode = data.qrCode;
        }
        return data.qrCode || this.lastQrCode || null;
      }
      return this.lastQrCode || null;
    } catch {
      return this.lastQrCode || null;
    }
  }

  async getStatus(): Promise<WhatsAppDeviceStatus> {
    // 3-second cache to prevent throttling
    if (this.lastStatusResult && (Date.now() - this.lastStatusResult.timestamp < 3000)) {
      return this.lastStatusResult.data;
    }

    const baseUrl = this.getBaseUrl();
    const session = await this.getActiveSession();

    if (!session) {
      const fallback: WhatsAppDeviceStatus = {
        status: 'DISCONNECTED',
        providerName: 'OpenWA REST API Gateway',
        isConfigured: this.isConfigured(),
        sessionStatus: 'Connecting to OpenWA gateway',
        details: `Connecting to OpenWA at ${baseUrl}`,
      };
      return fallback;
    }

    const isConnected = session.status === 'ready';
    let qrCode: string | undefined = undefined;

    if (!isConnected) {
      // Check if QR code is ready in OpenWA
      let fetchedQr = await this.getQrCode(session.id);
      if (!fetchedQr && session.status !== 'starting' && session.status !== 'ready') {
        try {
          await fetch(`${baseUrl}/api/sessions/${session.id}/start`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(6000),
          });
          fetchedQr = await this.getQrCode(session.id);
        } catch {}
      }
      if (fetchedQr) {
        qrCode = fetchedQr;
      }
    }

    const deviceStatus: WhatsAppDeviceStatus = {
      status: isConnected ? 'CONNECTED' : qrCode ? 'QR_READY' : 'CONNECTING',
      phoneNumber: session.phone ? `+${session.phone}` : undefined,
      providerName: `OpenWA Gateway (${session.name || 'gurukul'})`,
      isConfigured: true,
      qrCode,
      sessionStatus: `Session ${session.name} is ${session.status}`,
      details: `Active on ${baseUrl} via ${session.phone || 'WhatsApp'}`,
    };

    this.lastStatusResult = {
      data: deviceStatus,
      timestamp: Date.now(),
    };

    return deviceStatus;
  }

  async connect(): Promise<{ success: boolean; message: string; qrCode?: string; status: WhatsAppDeviceStatus }> {
    this.lastStatusResult = null; // Bust cache for explicit connect
    const baseUrl = this.getBaseUrl();
    const session = await this.getActiveSession();

    if (!session) {
      return {
        success: false,
        message: 'Could not initialize session on OpenWA gateway',
        status: {
          status: 'DISCONNECTED',
          providerName: 'OpenWA REST API Gateway',
          isConfigured: false,
        },
      };
    }

    // 1. Start the session in OpenWA
    try {
      await fetch(`${baseUrl}/api/sessions/${session.id}/start`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e: any) {
      console.warn('[OpenWA] Session start request note:', e.message);
    }

    // 2. Poll for QR code
    let qrCode: string | null = null;
    for (let i = 0; i < 4; i++) {
      qrCode = await this.getQrCode(session.id);
      if (qrCode) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const status = await this.getStatus();
    if (qrCode) {
      status.qrCode = qrCode;
      status.status = 'QR_READY';
    }

    return {
      success: true,
      message: qrCode
        ? 'Fresh QR code generated! Scan via WhatsApp on your phone.'
        : 'Session starting in background. QR code will appear momentarily.',
      qrCode: qrCode || undefined,
      status,
    };
  }

  async disconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    this.lastStatusResult = null;
    this.lastQrCode = null;
    const baseUrl = this.getBaseUrl();
    const session = await this.getActiveSession();

    if (session) {
      try {
        await fetch(`${baseUrl}/api/sessions/${session.id}/stop`, {
          method: 'POST',
          headers: this.getHeaders(),
        });
      } catch (err: any) {
        console.warn('[OpenWA] Disconnect error:', err.message);
      }
    }

    const status = await this.getStatus();
    return {
      success: true,
      message: 'OpenWA session stopped successfully',
      status,
    };
  }

  async reconnect(): Promise<{ success: boolean; message: string; qrCode?: string; status: WhatsAppDeviceStatus }> {
    return this.connect();
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const baseUrl = this.getBaseUrl();
    const session = await this.getActiveSession();

    if (!session) {
      return {
        success: false,
        provider: 'OPENWA',
        status: 'FAILED',
        errorMessage: 'No active OpenWA session found on gateway',
      };
    }

    const chatId = this.formatChatId(params.to);
    const text = params.body;
    const sendUrl = `${baseUrl}/api/sessions/${session.id}/messages/send-text`;

    console.log(`[OpenWA] Dispatching message to ${chatId} using session ${session.id} (${session.name})`);

    try {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          chatId,
          text,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        console.log(`[OpenWA] Successfully sent message to ${chatId}:`, data);
        return {
          success: true,
          provider: 'OPENWA',
          messageId: data.messageId || `openwa_${Date.now()}`,
          status: 'SENT',
        };
      }

      const errorText = await res.text().catch(() => '');
      console.error(`[OpenWA] Send failed with HTTP ${res.status}:`, errorText);
      return {
        success: false,
        provider: 'OPENWA',
        status: 'FAILED',
        errorMessage: `OpenWA HTTP ${res.status}: ${errorText}`,
      };
    } catch (err: any) {
      console.error(`[OpenWA] Error sending message to ${chatId}:`, err.message);
      return {
        success: false,
        provider: 'OPENWA',
        status: 'FAILED',
        errorMessage: err.message,
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const status = await this.getStatus();
    return {
      healthy: status.status === 'CONNECTED',
      details: status.details,
    };
  }
}

export const openWaProvider = new OpenWaProvider();
