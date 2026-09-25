import {
  WhatsAppSender,
  SendMessageParams,
  SendMessageResult,
  WhatsAppDeviceStatus,
} from './whatsappProvider.interface.js';

export class MockWhatsAppProvider implements WhatsAppSender {
  readonly name = 'MOCK' as const;

  private _connected = true;
  private _lastConnectedAt = new Date().toISOString();

  async getStatus(): Promise<WhatsAppDeviceStatus> {
    return {
      status: this._connected ? 'CONNECTED' : 'DISCONNECTED',
      phoneNumber: '+919999999999',
      lastConnectedAt: this._lastConnectedAt,
      lastHeartbeatAt: this._connected ? new Date().toISOString() : undefined,
      sessionStatus: this._connected ? 'Mock development provider ready' : 'Mock provider disconnected',
      providerName: 'Mock Provider (Development & Testing)',
      isConfigured: true,
      details: 'Safe local simulation environment — no actual SMS/WhatsApp charges incurred',
    };
  }

  async connect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    this._connected = true;
    this._lastConnectedAt = new Date().toISOString();
    return {
      success: true,
      message: 'Mock WhatsApp provider connected',
      status: await this.getStatus(),
    };
  }

  async disconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    this._connected = false;
    return {
      success: true,
      message: 'Mock WhatsApp provider disconnected',
      status: await this.getStatus(),
    };
  }

  async reconnect(): Promise<{ success: boolean; message: string; status: WhatsAppDeviceStatus }> {
    this._connected = true;
    this._lastConnectedAt = new Date().toISOString();
    return {
      success: true,
      message: 'Mock WhatsApp provider reconnected',
      status: await this.getStatus(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    return {
      healthy: this._connected,
      details: this._connected ? 'Mock provider operational' : 'Mock provider disconnected',
    };
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    if (!this._connected) {
      return {
        success: false,
        provider: 'MOCK',
        status: 'FAILED',
        errorMessage: 'Mock provider is currently disconnected',
      };
    }

    const { to } = params;

    // Simulate negative failure case when recipient includes 'fail' or is invalid
    if (!to || to.includes('fail') || to.includes('0000000000') || to.trim().length < 5) {
      return {
        success: false,
        provider: 'MOCK',
        status: 'FAILED',
        errorMessage: 'Simulated delivery failure (MOCK): Invalid recipient phone number',
      };
    }

    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    const messageId = `mock_msg_${timestamp}_${random}`;

    // Per docs/08_AUTOMATIONS.md, mock messages must never be called "delivered".
    return {
      success: true,
      provider: 'MOCK',
      messageId,
      status: 'MOCK',
    };
  }
}
