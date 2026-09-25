import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { AppError } from '../middlewares/errorHandler.js';

export class DashboardController {
  static async getAdminDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getAdminKPIs(req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.teacherId;
      if (!teacherId) {
        throw new AppError('No teacher profile linked to your account.', 403, 'FORBIDDEN');
      }

      const data = await DashboardService.getTeacherKPIs(teacherId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
