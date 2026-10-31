import { Request, Response, NextFunction } from 'express';
import { announcementService } from '../services/announcement.service.js';
import { createAnnouncementSchema } from '../types/report.types.js';
import { ROLES } from '../constants/index.js';
import { whatsappSettingsService } from '../services/whatsapp/whatsappSettings.service.js';
import { whatsappProviderFactory } from '../services/whatsapp/whatsappProvider.factory.js';

export class AnnouncementController {
  // ============================================================================
  // 1. CREATE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createAnnouncementSchema.parse(req.body);
      const data = await announcementService.createAnnouncement(validated, req.user?.profileId);

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 2. LIST ANNOUNCEMENTS
  // ============================================================================
  async listAnnouncements(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.role === ROLES.TEACHER ? req.user.teacherId : undefined;
      const data = await announcementService.listAnnouncements(teacherId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 3. GET ANNOUNCEMENT BY ID
  // ============================================================================
  async getAnnouncementById(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.role === ROLES.TEACHER ? req.user.teacherId : undefined;
      const data = await announcementService.getAnnouncementById(req.params.id, teacherId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 4. SEND ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async sendAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const scheduledTime = req.body?.scheduledTime;
      const isScheduledFuture = Boolean(
        scheduledTime && new Date(scheduledTime).getTime() > Date.now() + 30000
      );

      // Guard: If broadcasting immediately (not scheduled for future), verify gateway is connected
      if (!isScheduledFuture) {
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
                message: `WhatsApp Gateway is currently ${deviceStatus.status}. Please scan QR code in WhatsApp settings before broadcasting immediately.`,
              },
            });
          }
        } catch (statusErr: any) {
          console.warn('[AnnouncementController] WhatsApp status check warning:', statusErr?.message);
        }
      }

      const includeTwoWayPrompt = req.body?.includeTwoWayPrompt !== false;
      const result = await announcementService.sendAnnouncement(req.params.id, {
        scheduledTime,
        includeTwoWayPrompt,
        customTemplate: req.body?.customTemplate,
        tournamentIds: req.body?.tournamentIds,
        teamCodes: req.body?.teamCodes,
        teamMemberIds: req.body?.teamMemberIds,
        includeSelf: req.body?.includeSelf,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5. UPDATE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async updateAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await announcementService.updateAnnouncement(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Announcement updated successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 6. DELETE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await announcementService.deleteAnnouncement(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Announcement deleted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 7. LIST SCHEDULED ANNOUNCEMENTS
  // ============================================================================
  async listScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.role === ROLES.TEACHER ? req.user.teacherId : undefined;
      const data = await announcementService.listScheduledAnnouncements(teacherId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 8. UPDATE SCHEDULED ANNOUNCEMENT
  // ============================================================================
  async updateScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await announcementService.updateScheduledAnnouncement(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Scheduled announcement updated successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 9. DELETE / CANCEL SCHEDULED ANNOUNCEMENT
  // ============================================================================
  async deleteScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const permanent = req.query.permanent === 'true';
      const result = await announcementService.deleteScheduledAnnouncement(req.params.id, permanent);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 10. DISPATCH SCHEDULED ANNOUNCEMENT NOW
  // ============================================================================
  async dispatchScheduledNow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await announcementService.dispatchScheduledAnnouncementNow(req.params.id);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const announcementController = new AnnouncementController();
