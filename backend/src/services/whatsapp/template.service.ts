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
        name: 'विद्यार्थी गैरहजर सूचना (Absent Alert)',
        event_type: 'ATTENDANCE_ABSENT',
        body: 'नमस्कार {{parent_name}}, आपला पाल्य {{student_name}} आज दिनांक {{date}} रोजी {{academy_name}} मधील {{batch_name}} च्या सराव सत्राला गैरहजर (ABSENT) होता.\n\n- {{academy_name}}',
        active: true,
      },
      ATTENDANCE_PRESENT: {
        id: 'default-attendance-present',
        name: 'विद्यार्थी उपस्थिती पुष्टी (Present Confirmation)',
        event_type: 'ATTENDANCE_PRESENT',
        body: 'नमस्कार {{parent_name}}, आपला पाल्य {{student_name}} आज दिनांक {{date}} रोजी {{academy_name}} मधील {{batch_name}} च्या सराव सत्राला उपस्थित (PRESENT) होता.\n\n- {{academy_name}}',
        active: true,
      },
      ATTENDANCE_CORRECTION: {
        id: 'default-attendance-correction',
        name: 'हजेरी दुरुस्ती सूचना (Attendance Correction)',
        event_type: 'ATTENDANCE_CORRECTION',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची {{batch_name}} सराव सत्राची दिनांक {{date}} ची हजेरी नोंद उपस्थित (PRESENT) म्हणून अद्ययावत करण्यात आली आहे.\n\n- {{academy_name}}',
        active: true,
      },
      FEE_DUE: {
        id: 'default-fee-due',
        name: 'फी देय आठवण (Fee Due Reminder)',
        event_type: 'FEE_DUE',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची {{academy_name}} येथील ₹{{amount}} मासिक फी दिनांक {{due_date}} पर्यंत देय (Due) आहे. कृपया वेळेवर फी जमा करून सहकार्य करावे.\n\n- {{academy_name}}',
        active: true,
      },
      FEE_OVERDUE: {
        id: 'default-fee-overdue',
        name: 'थकीत फी सूचना (Fee Overdue Alert)',
        event_type: 'FEE_OVERDUE',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची ₹{{amount}} फी दिनांक {{due_date}} पासून थकीत (Overdue) आहे. सराव सत्रात खंड पडू नये म्हणून कृपया लवकरात लवकर फी जमा करावी ही नम्र विनंती.\n\n- {{academy_name}}',
        active: true,
      },
      PAYMENT_SUCCESS: {
        id: 'default-payment-success',
        name: 'फी पावती पुष्टी (Payment Received Confirmation)',
        event_type: 'PAYMENT_SUCCESS',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची ₹{{amount}} फी यशस्वीरीत्या जमा झाली आहे. पावती क्र: {{receipt_number}}.\n\n{{academy_name}} मध्ये विश्वास दाखवल्याबद्दल मनःपूर्वक धन्यवाद!',
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
        name: 'विद्यार्थी गैरहजर सूचना (Absent Alert)',
        eventType: 'ATTENDANCE_ABSENT',
        body: 'नमस्कार {{parent_name}}, आपला पाल्य {{student_name}} आज दिनांक {{date}} रोजी {{academy_name}} मधील {{batch_name}} च्या सराव सत्राला गैरहजर (ABSENT) होता.\n\n- {{academy_name}}',
        active: true,
      },
      {
        name: 'विद्यार्थी उपस्थिती पुष्टी (Present Confirmation)',
        eventType: 'ATTENDANCE_PRESENT',
        body: 'नमस्कार {{parent_name}}, आपला पाल्य {{student_name}} आज दिनांक {{date}} रोजी {{academy_name}} मधील {{batch_name}} च्या सराव सत्राला उपस्थित (PRESENT) होता.\n\n- {{academy_name}}',
        active: true,
      },
      {
        name: 'हजेरी दुरुस्ती सूचना (Attendance Correction)',
        eventType: 'ATTENDANCE_CORRECTION',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची {{batch_name}} सराव सत्राची दिनांक {{date}} ची हजेरी नोंद उपस्थित (PRESENT) म्हणून अद्ययावत करण्यात आली आहे.\n\n- {{academy_name}}',
        active: true,
      },
      {
        name: 'फी पावती पुष्टी (Payment Received Confirmation)',
        eventType: 'PAYMENT_SUCCESS',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची ₹{{amount}} फी यशस्वीरीत्या जमा झाली आहे. पावती क्र: {{receipt_number}}.\n\n{{academy_name}} मध्ये विश्वास दाखवल्याबद्दल मनःपूर्वक धन्यवाद!',
        active: true,
      },
      {
        name: 'फी देय आठवण (Fee Due Reminder)',
        eventType: 'FEE_DUE',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची {{academy_name}} येथील ₹{{amount}} मासिक फी दिनांक {{due_date}} पर्यंत देय (Due) आहे. कृपया वेळेवर फी जमा करून सहकार्य करावे.\n\n- {{academy_name}}',
        active: true,
      },
      {
        name: 'थकीत फी सूचना (Fee Overdue Alert)',
        eventType: 'FEE_OVERDUE',
        body: 'नमस्कार {{parent_name}}, {{student_name}} ची ₹{{amount}} फी दिनांक {{due_date}} पासून थकीत (Overdue) आहे. सराव सत्रात खंड पडू नये म्हणून कृपया लवकरात लवकर फी जमा करावी ही नम्र विनंती.\n\n- {{academy_name}}',
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
