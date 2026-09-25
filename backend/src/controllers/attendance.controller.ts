import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service.js';
import { bulkAttendanceSchema, updateAttendanceSchema } from '../types/attendance.types.js';
import { AppError } from '../middlewares/errorHandler.js';

export class AttendanceController {
  static async getBatchAttendanceSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const batchId = req.query.batchId as string;
      const date = req.query.date as string;

      if (!batchId) {
        throw new AppError('batchId query parameter is required', 400);
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError('date query parameter formatted as YYYY-MM-DD is required', 400);
      }

      const data = await AttendanceService.getBatchAttendanceSheet(batchId, date, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async markBulkAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bulkAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await AttendanceService.markBulkAttendance(parsed.data, req.user!);
      res.status(200).json({
        success: true,
        message: 'Attendance recorded successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;

      const data = await AttendanceService.listAttendance(
        { batchId, date, startDate, endDate, studentId },
        req.user!
      );
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAttendanceRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Attendance ID is required', 400);

      const parsed = updateAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await AttendanceService.updateAttendanceRecord(id, parsed.data, req.user!);
      res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
