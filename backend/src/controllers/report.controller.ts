import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service.js';
import {
  attendanceReportFilterSchema,
  feesReportFilterSchema,
  paymentsReportFilterSchema,
} from '../types/report.types.js';
import { ROLES } from '../constants/index.js';

export class ReportController {
  // ============================================================================
  // 1. ATTENDANCE REPORT
  // ============================================================================
  async getAttendanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = attendanceReportFilterSchema.parse({
        batchId: req.query.batchId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        studentId: req.query.studentId,
      });

      const teacherId = req.user?.role === ROLES.TEACHER ? req.user.teacherId : undefined;
      const data = await reportService.getAttendanceReport(filters, teacherId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 2. FEES REPORT (Admin Only)
  // ============================================================================
  async getFeesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = feesReportFilterSchema.parse({
        batchId: req.query.batchId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      const data = await reportService.getFeesReport(filters);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 3. PAYMENTS REPORT (Admin Only)
  // ============================================================================
  async getPaymentsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = paymentsReportFilterSchema.parse({
        provider: req.query.provider,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      const data = await reportService.getPaymentsReport(filters);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 4. CSV EXPORTS
  // ============================================================================
  async exportAttendanceCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = attendanceReportFilterSchema.parse({
        batchId: req.query.batchId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        studentId: req.query.studentId,
      });

      const teacherId = req.user?.role === ROLES.TEACHER ? req.user.teacherId : undefined;
      const csv = await reportService.exportAttendanceCsv(filters, teacherId);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  async exportFeesCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = feesReportFilterSchema.parse({
        batchId: req.query.batchId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      const csv = await reportService.exportFeesCsv(filters);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fees-report-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  async exportPaymentsCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = paymentsReportFilterSchema.parse({
        provider: req.query.provider,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      const csv = await reportService.exportPaymentsCsv(filters);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments-report-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
