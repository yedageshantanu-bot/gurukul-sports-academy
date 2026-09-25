import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  CreateTemplateDTO,
  UpdateTemplateDTO,
  WhatsAppEventType,
} from '../../types/whatsapp.types.js';

export class TemplateService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  async createTemplate(dto: CreateTemplateDTO) {
    const { data, error } = await this.supabase
      .from('whatsapp_templates')
      .insert({
        name: dto.name,
        event_type: dto.eventType,
        body: dto.body,
        active: dto.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[TemplateService.createTemplate] Error:', error);
      throw new AppError(`Failed to create template: ${error.message}`, 500);
    }

    return data;
  }

  async listTemplates(activeOnly = false) {
    let query = this.supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[TemplateService.listTemplates] Error:', error);
      throw new AppError(`Failed to list templates: ${error.message}`, 500);
    }

    return data || [];
  }

  async getTemplateById(id: string) {
    const { data, error } = await this.supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('WhatsApp template not found', 404, 'RESOURCE_NOT_FOUND');
    }

    return data;
  }

  async getActiveTemplateForEvent(eventType: WhatsAppEventType) {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('event_type', eventType)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fall through to in-memory templates
    }

    const defaultTemplates: Record<string, any> = {
      ATTENDANCE_ABSENT: {
        id: 'default-attendance-absent',
        name: 'Absent Student Alert',
        event_type: 'ATTENDANCE_ABSENT',
        body: 'Dear {{parent_name}}, your ward {{student_name}} was marked ABSENT today ({{date}}) for {{batch_name}} at {{academy_name}}.',
        active: true,
      },
      ATTENDANCE_PRESENT: {
        id: 'default-attendance-present',
        name: 'Present Student Confirmation',
        event_type: 'ATTENDANCE_PRESENT',
        body: 'Dear {{parent_name}}, your ward {{student_name}} attended training today ({{date}}) for {{batch_name}} at {{academy_name}}.',
        active: true,
      },
      ATTENDANCE_CORRECTION: {
        id: 'default-attendance-correction',
        name: 'Attendance Correction Alert',
        event_type: 'ATTENDANCE_CORRECTION',
        body: 'Dear {{parent_name}}, the attendance record for {{student_name}} for {{batch_name}} on {{date}} has been updated to PRESENT at {{academy_name}}.',
        active: true,
      },
      FEE_DUE: {
        id: 'default-fee-due',
        name: 'Fee Due Reminder',
        event_type: 'FEE_DUE',
        body: 'Dear {{parent_name}}, fee of ₹{{amount}} for {{student_name}} at {{academy_name}} is due on {{due_date}}. Kindly settle the dues at your earliest convenience.',
        active: true,
      },
      FEE_OVERDUE: {
        id: 'default-fee-overdue',
        name: 'Fee Overdue Alert',
        event_type: 'FEE_OVERDUE',
        body: 'Dear {{parent_name}}, fee of ₹{{amount}} for {{student_name}} at {{academy_name}} is now OVERDUE since {{due_date}}. Please complete the payment to avoid disruption in training.',
        active: true,
      },
      PAYMENT_SUCCESS: {
        id: 'default-payment-success',
        name: 'Payment Received Confirmation',
        event_type: 'PAYMENT_SUCCESS',
        body: 'Dear {{parent_name}}, we have received payment of ₹{{amount}} for {{student_name}} at {{academy_name}}. Receipt Ref: {{receipt_number}}.\n\nThank you for choosing {{academy_name}}!',
        active: true,
      },
    };

    return defaultTemplates[eventType] || null;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDTO) {
    await this.getTemplateById(id);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.eventType !== undefined) updatePayload.event_type = dto.eventType;
    if (dto.body !== undefined) updatePayload.body = dto.body;
    if (dto.active !== undefined) updatePayload.active = dto.active;

    const { data, error } = await this.supabase
      .from('whatsapp_templates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[TemplateService.updateTemplate] Error:', error);
      throw new AppError(`Failed to update template: ${error.message}`, 500);
    }

    return data;
  }

  async toggleTemplateStatus(id: string, active: boolean) {
    return this.updateTemplate(id, { active });
  }

  async seedDefaultTemplatesIfEmpty() {
    const existing = await this.listTemplates(false);
    if (existing.length > 0) return;

    const defaultTemplates: CreateTemplateDTO[] = [
      {
        name: 'Absent Student Alert',
        eventType: 'ATTENDANCE_ABSENT',
        body: 'Dear {{parent_name}}, your child {{student_name}} was marked ABSENT today ({{date}}) for batch {{batch_name}} at {{academy_name}}. Please let us know if you need any assistance.',
        active: true,
      },
      {
        name: 'Payment Received Confirmation',
        eventType: 'PAYMENT_SUCCESS',
        body: 'Dear {{parent_name}}, we have received payment of ₹{{amount}} for {{student_name}} at {{academy_name}}. Receipt Ref: {{receipt_number}}. Thank you!',
        active: true,
      },
      {
        name: 'Fee Due Reminder',
        eventType: 'FEE_DUE',
        body: 'Dear {{parent_name}}, fee of ₹{{amount}} for {{student_name}} at {{academy_name}} is due on {{due_date}}. Kindly settle the dues at your earliest convenience.',
        active: true,
      },
      {
        name: 'Fee Overdue Alert',
        eventType: 'FEE_OVERDUE',
        body: 'Dear {{parent_name}}, fee of ₹{{amount}} for {{student_name}} is now OVERDUE since {{due_date}}. Please complete the payment to avoid disruption in classes.',
        active: true,
      },
    ];

    for (const t of defaultTemplates) {
      try {
        await this.createTemplate(t);
      } catch (e) {
        // ignore duplicate seeding conflicts
      }
    }
  }
}

export const templateService = new TemplateService();
