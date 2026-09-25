import { Request, Response, NextFunction } from 'express';
import { announcementService } from '../services/announcement.service.js';
import { createAnnouncementSchema } from '../types/report.types.js';
import { ROLES } from '../constants/index.js';

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
      const result = await announcementService.sendAnnouncement(req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const announcementController = new AnnouncementController();
