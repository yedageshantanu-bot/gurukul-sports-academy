import { Request, Response, NextFunction } from 'express';
import { templateService } from '../services/whatsapp/template.service.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { whatsappSettingsService } from '../services/whatsapp/whatsappSettings.service.js';
import { whatsappProviderFactory } from '../services/whatsapp/whatsappProvider.factory.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  sendCustomMessageSchema,
  triggerFeeReminderSchema,
  updateWhatsAppSettingsSchema,
  toggleEmergencyStopSchema,
  toggleOptInSchema,
  processQueueSchema,
  WhatsAppMessageStatus,
  WhatsAppQueueStatus,
} from '../types/whatsapp.types.js';

export class WhatsAppController {
  // ============================================================================
  // STATUS & DEVICE MANAGEMENT
  // ============================================================================
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      const stats = await queueService.getTodayStats();

      if (
        deviceStatus.status &&
        (deviceStatus.status !== settings.device_status || deviceStatus.phoneNumber !== settings.device_phone_number)
      ) {
        whatsappSettingsService
          .updateDeviceStatus(deviceStatus.status, deviceStatus.phoneNumber, {
            sessionStatus: deviceStatus.sessionStatus,
          })
          .catch(() => {});
      }

      res.status(200).json({
        success: true,
        data: {
          provider: {
            name: provider.name,
            selected: settings.provider_type,
          },
          device: deviceStatus,
          automation: {
            globalEnabled: settings.global_automation_enabled,
            emergencyStop: settings.emergency_stop,
          },
          stats,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async connectDevice(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const result = await provider.connect();

      await whatsappSettingsService.updateDeviceStatus(
        result.status.status,
        result.status.phoneNumber,
        { sessionStatus: result.status.sessionStatus }
      );

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async disconnectDevice(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const result = await provider.disconnect();

      await whatsappSettingsService.updateDeviceStatus('DISCONNECTED', undefined, {
        sessionStatus: 'Disconnected by admin command',
      });

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async reconnectDevice(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const result = await provider.reconnect();

      await whatsappSettingsService.updateDeviceStatus(
        result.status.status,
        result.status.phoneNumber,
        { sessionStatus: result.status.sessionStatus }
      );

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // SETTINGS & AUTOMATION CONTROLS
  // ============================================================================
  async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const stats = await queueService.getTodayStats();

      res.status(200).json({
        success: true,
        data: {
          settings,
          stats,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateWhatsAppSettingsSchema.parse(req.body);
      const updated = await whatsappSettingsService.updateSettings(validated);
      const stats = await queueService.getTodayStats();

      res.status(200).json({
        success: true,
        data: {
          settings: updated,
          stats,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async toggleEmergencyStop(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = toggleEmergencyStopSchema.parse(req.body);
      const updated = await whatsappSettingsService.setEmergencyStop(validated.emergencyStop);

      res.status(200).json({
        success: true,
        message: validated.emergencyStop ? 'Emergency stop ACTIVATED' : 'Emergency stop DEACTIVATED',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateOptIn(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = toggleOptInSchema.parse(req.body);
      await whatsappSettingsService.setOptIn(
        { studentId: validated.studentId, phoneNumber: validated.phoneNumber },
        validated.optIn
      );

      res.status(200).json({
        success: true,
        message: `Opt-in preference set to ${validated.optIn}`,
        data: validated,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // MESSAGE QUEUE
  // ============================================================================
  async listQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as WhatsAppQueueStatus | undefined,
        recipientPhone: req.query.recipientPhone as string | undefined,
        studentId: req.query.studentId as string | undefined,
        eventType: req.query.eventType as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const queue = await queueService.listQueue(filters);
      res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (err) {
      next(err);
    }
  }

  async enqueueMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = sendCustomMessageSchema.parse(req.body);
      const queued = await queueService.enqueueMessage({
        recipientPhone: validated.recipientPhone,
        messageBody: validated.messageBody,
        studentId: validated.studentId,
        templateId: validated.templateId,
        eventType: validated.eventType,
        scheduledAt: validated.scheduledAt,
      });

      res.status(201).json({
        success: true,
        data: queued,
      });
    } catch (err) {
      next(err);
    }
  }

  async processQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before dispatching messages.`,
          },
        });
      }

      const batchSize = req.body.batchSize ? Number(req.body.batchSize) : 50;
      const forceNow = req.body.forceNow === true;
      const result = await queueService.processQueue(batchSize, forceNow);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async retryMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await queueService.retryMessage(req.params.id);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // MESSAGE AUDIT LOGS
  // ============================================================================
  async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as WhatsAppMessageStatus | undefined,
        eventType: req.query.eventType as string | undefined,
        studentId: req.query.studentId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const logs = await automationService.listMessages(filters);
      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }

  // Backwards compatible alias for listMessages
  async listMessages(req: Request, res: Response, next: NextFunction) {
    return this.listLogs(req, res, next);
  }

  async sendCustomMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before sending messages.`,
          },
        });
      }

      const validated = sendCustomMessageSchema.parse(req.body);
      const result = await automationService.sendCustomMessage(validated);

      if (!result.result.success || result.message.status === 'FAILED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DELIVERY_FAILED',
            message: result.result.errorMessage || result.message.error_message || 'Failed to dispatch WhatsApp message.',
          },
        });
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async triggerFeeReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before sending fee reminders.`,
          },
        });
      }

      const validated = triggerFeeReminderSchema.parse(req.body);
      const studentId = req.body.studentId;

      const log = await automationService.triggerFeeReminderAutomation({
        studentId,
        studentFeeId: validated.studentFeeId,
        eventType: req.body.eventType,
      });

      if (log.status === 'FAILED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DELIVERY_FAILED',
            message: log.error_message || 'WhatsApp fee reminder delivery failed.',
          },
        });
      }

      res.status(200).json({
        success: true,
        data: log,
      });
    } catch (err) {
      next(err);
    }
  }

  async triggerMonthlyFeeReminders(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before broadcasting fee reminders.`,
          },
        });
      }

      const result = await automationService.triggerMonthly5thFeeDueAutomation();
      queueService.triggerBackgroundProcessing();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async triggerFeeCadenceReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before broadcasting fee reminders.`,
          },
        });
      }

      const forceAllUnpaid = req.body.forceAllUnpaid === true;
      const result = await automationService.triggerMultiStageFeeCadenceAutomation({ forceAllUnpaid });

      // Non-blocking trigger of background queue processor
      queueService.triggerBackgroundProcessing();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================
  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTemplateSchema.parse(req.body);
      const template = await templateService.createTemplate(validated);
      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      await templateService.seedDefaultTemplatesIfEmpty();
      const activeOnly = req.query.active === 'true';
      const templates = await templateService.listTemplates(activeOnly);
      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await templateService.getTemplateById(req.params.id);
      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateTemplateSchema.parse(req.body);
      const template = await templateService.updateTemplate(req.params.id, validated);
      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  async activateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await templateService.toggleTemplateStatus(req.params.id, true);
      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await templateService.toggleTemplateStatus(req.params.id, false);
      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // MONTHLY PDF REPORTS
  // ============================================================================
  async sendStudentMonthlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before sending student reports.`,
          },
        });
      }

      const studentId = req.params.studentId;
      const result = await automationService.sendStudentMonthlyReport(studentId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DELIVERY_FAILED',
            message: result.error || 'Failed to dispatch student report via WhatsApp.',
          },
        });
      }

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async sendAllMonthlyReports(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const deviceStatus = await provider.getStatus();
      if (deviceStatus.status !== 'CONNECTED') {
        return res.status(400).json({
          success: false,
          disconnected: true,
          error: {
            code: 'WHATSAPP_DISCONNECTED',
            message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before broadcasting student reports.`,
          },
        });
      }

      const result = await automationService.sendAllMonthlyReportsBatch();
      queueService.triggerBackgroundProcessing();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadStudentReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId;
      const { buffer, fileName } = await automationService.getStudentReportPdfBuffer(studentId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

export const whatsappController = new WhatsAppController();
