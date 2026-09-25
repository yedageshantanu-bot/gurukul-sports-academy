import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  WhatsAppSender,
  SendMessageParams,
  SendMessageResult,
  WhatsAppDeviceStatus,
} from './whatsappProvider.interface.js';

export class MetaWhatsAppProvider implements WhatsAppSender {
  readonly name = 'META' as const;

  private get accessToken(): string {
    return env.WHATSAPP_ACCESS_TOKEN || '';
  }

  private get phoneNumberId(): string {
    return env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  async getStatus(): Promise<WhatsAppDeviceStatus> {
    const configured = this.isConfigured();
    return {
      status: configured ? 'CONNECTED' : 'NOT_CONFIGURED',
      phoneNumber: this.phoneNumberId ? `ID: ${this.phoneNumberId}` : undefined,
      providerName: 'Meta WhatsApp Cloud API',
      isConfigured: configured,
      details: configured
        ? 'Meta Cloud API configured and ready'
        : 'Meta Cloud API credentials not configured (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID required)',
    };
  }

  async connect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Meta WhatsApp Cloud API credentials are not configured.',
        status: await this.getStatus(),
      };
    }
    return {
      success: true,
      message: 'Meta WhatsApp Cloud API connection verified.',
      status: await this.getStatus(),
    };
  }

  async disconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    return {
      success: true,
      message: 'Meta WhatsApp Cloud API is a stateless cloud endpoint.',
      status: await this.getStatus(),
    };
  }

  async reconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    return this.connect();
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    return {
      healthy: this.isConfigured(),
      details: this.isConfigured() ? 'Meta Cloud API configured' : 'Meta Cloud API credentials missing',
    };
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Meta WhatsApp API credentials are not configured on this server. Please use MOCK provider or configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    const { to, body } = params;

    // Clean phone number (remove spaces, dashes)
    const formattedTo = to.replace(/\D/g, '');

    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedTo,
          type: 'text',
          text: {
            preview_url: false,
            body,
          },
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        return {
          success: false,
          provider: 'META',
          status: 'FAILED',
          errorMessage: data.error?.message || 'Failed to dispatch WhatsApp message via Meta API',
        };
      }

      const messageId = data.messages?.[0]?.id;

      return {
        success: true,
        provider: 'META',
        messageId,
        status: 'SENT',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'META',
        status: 'FAILED',
        errorMessage: err.message || 'Network error communicating with Meta API',
      };
    }
  }
}
