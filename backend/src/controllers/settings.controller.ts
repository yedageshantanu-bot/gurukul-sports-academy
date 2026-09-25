import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service.js';
import { updateAcademySettingsSchema } from '../types/settings.types.js';

export class SettingsController {
  // ============================================================================
  // 1. GET ACADEMY SETTINGS
  // ============================================================================
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.getSettings(req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 2. UPDATE ACADEMY SETTINGS (Admin Only)
  // ============================================================================
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateAcademySettingsSchema.parse(req.body);
      const data = await settingsService.updateSettings(validated, req.user);

      res.status(200).json({
        success: true,
        message: 'Academy settings updated successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
