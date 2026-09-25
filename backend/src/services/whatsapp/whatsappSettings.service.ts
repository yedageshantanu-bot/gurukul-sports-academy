import { supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import {
  WhatsAppSettings,
  UpdateWhatsAppSettingsDTO,
  TodayStats,
  WhatsAppDeviceStatusEnum,
  WhatsAppProviderType,
} from '../../types/whatsapp.types.js';

export class WhatsAppSettingsService {
  private inMemorySettings: WhatsAppSettings = {
    id: 'default_whatsapp_settings',
    global_automation_enabled: true,
    emergency_stop: false,
    daily_limit: env.WHATSAPP_DAILY_LIMIT || 40,
    provider_type: (env.WHATSAPP_PROVIDER as WhatsAppProviderType) || 'mock',
    device_phone_number: null,
    device_status: 'NOT_CONFIGURED',
    last_connected_at: null,
    last_heartbeat_at: null,
    session_metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Opted-out phone numbers or students in-memory cache/override
  private optOutSet = new Set<string>();

  private get supabase() {
    return supabaseAdmin;
  }

  async getSettings(): Promise<WhatsAppSettings> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('whatsapp_settings')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          // Keep in-memory cache updated with DB
          this.inMemorySettings = {
            ...this.inMemorySettings,
            ...data,
          };
          return data as WhatsAppSettings;
        }
      } catch {
        // Table not present in DB, use in-memory state
      }
    }

    return this.inMemorySettings;
  }

  async updateSettings(dto: UpdateWhatsAppSettingsDTO): Promise<WhatsAppSettings> {
    const current = await this.getSettings();

    const updated: WhatsAppSettings = {
      ...current,
      global_automation_enabled:
        dto.globalAutomationEnabled !== undefined
          ? dto.globalAutomationEnabled
          : current.global_automation_enabled,
      emergency_stop:
        dto.emergencyStop !== undefined ? dto.emergencyStop : current.emergency_stop,
      daily_limit:
        dto.dailyLimit !== undefined ? dto.dailyLimit : current.daily_limit,
      provider_type:
        dto.providerType !== undefined ? dto.providerType : current.provider_type,
      updated_at: new Date().toISOString(),
    };

    this.inMemorySettings = updated;

    if (this.supabase) {
      try {
        await this.supabase
          .from('whatsapp_settings')
          .update({
            global_automation_enabled: updated.global_automation_enabled,
            emergency_stop: updated.emergency_stop,
            daily_limit: updated.daily_limit,
            provider_type: updated.provider_type,
            updated_at: updated.updated_at,
          })
          .eq('id', current.id);
      } catch {
        // Table update failed or table missing, inMemory is updated
      }
    }

    return updated;
  }

  async setEmergencyStop(emergencyStop: boolean): Promise<WhatsAppSettings> {
    return this.updateSettings({ emergencyStop });
  }

  async setGlobalAutomation(globalAutomationEnabled: boolean): Promise<WhatsAppSettings> {
    return this.updateSettings({ globalAutomationEnabled });
  }

  async updateDeviceStatus(
    status: WhatsAppDeviceStatusEnum,
    phoneNumber?: string,
    sessionMetadata?: Record<string, any>
  ): Promise<WhatsAppSettings> {
    const current = await this.getSettings();
    const updated: WhatsAppSettings = {
      ...current,
      device_status: status,
      device_phone_number: phoneNumber !== undefined ? phoneNumber : current.device_phone_number,
      last_connected_at: status === 'CONNECTED' ? new Date().toISOString() : current.last_connected_at,
      last_heartbeat_at: status === 'CONNECTED' ? new Date().toISOString() : current.last_heartbeat_at,
      session_metadata: sessionMetadata ? { ...current.session_metadata, ...sessionMetadata } : current.session_metadata,
      updated_at: new Date().toISOString(),
    };

    this.inMemorySettings = updated;

    if (this.supabase) {
      try {
        await this.supabase
          .from('whatsapp_settings')
          .update({
            device_status: updated.device_status,
            device_phone_number: updated.device_phone_number,
            last_connected_at: updated.last_connected_at,
            last_heartbeat_at: updated.last_heartbeat_at,
            session_metadata: updated.session_metadata,
            updated_at: updated.updated_at,
          })
          .eq('id', current.id);
      } catch {
        // Ignored if table not in schema
      }
    }

    return updated;
  }

  // ============================================================================
  // OPT-IN / OPT-OUT CONTROLS
  // ============================================================================
  async setOptIn(identifier: { studentId?: string; phoneNumber?: string }, optIn: boolean): Promise<boolean> {
    const key = identifier.phoneNumber ? identifier.phoneNumber.replace(/[^\d+]/g, '') : identifier.studentId;
    if (!key) return false;

    if (optIn) {
      this.optOutSet.delete(key);
    } else {
      this.optOutSet.add(key);
    }

    // If student ID provided and supabase is available, attempt updating student record
    if (identifier.studentId && this.supabase) {
      try {
        await this.supabase
          .from('students')
          .update({ whatsapp_opt_in: optIn })
          .eq('id', identifier.studentId);
      } catch {
        // Table column might not exist yet
      }
    }

    return true;
  }

  async isOptedIn(identifier: { studentId?: string; phoneNumber?: string }): Promise<boolean> {
    const cleanedPhone = identifier.phoneNumber ? identifier.phoneNumber.replace(/[^\d+]/g, '') : null;

    if (cleanedPhone && this.optOutSet.has(cleanedPhone)) {
      return false;
    }
    if (identifier.studentId && this.optOutSet.has(identifier.studentId)) {
      return false;
    }

    // Check student record in database if studentId is supplied
    if (identifier.studentId && this.supabase) {
      try {
        const { data } = await this.supabase
          .from('students')
          .select('whatsapp_opt_in')
          .eq('id', identifier.studentId)
          .maybeSingle();

        if (data && data.whatsapp_opt_in !== undefined && data.whatsapp_opt_in !== null) {
          return Boolean(data.whatsapp_opt_in);
        }
      } catch {
        // Default to true if column not present yet
      }
    }

    return true;
  }
}

export const whatsappSettingsService = new WhatsAppSettingsService();
