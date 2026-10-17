import { Request, Response, NextFunction } from 'express';
import { feeService } from '../services/fee.service.js';
import {
  createFeePlanSchema,
  updateFeePlanSchema,
  assignStudentFeeSchema,
  updateStudentFeeSchema,
  StudentFeeStatus,
} from '../types/fee.types.js';

export class FeeController {
  // ============================================================================
  // FEE PLANS
  // ============================================================================

  async createFeePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createFeePlanSchema.parse(req.body);
      const plan = await feeService.createFeePlan(validated);
      res.status(201).json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async listFeePlans(req: Request, res: Response, next: NextFunction) {
    try {
      const activeOnly = req.query.active === 'true';
      const plans = await feeService.listFeePlans(activeOnly);
      res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (err) {
      next(err);
    }
  }

  async getFeePlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await feeService.getFeePlanById(req.params.id);
      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateFeePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateFeePlanSchema.parse(req.body);
      const plan = await feeService.updateFeePlan(req.params.id, validated);
      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async activateFeePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await feeService.toggleFeePlanStatus(req.params.id, true);
      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateFeePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await feeService.toggleFeePlanStatus(req.params.id, false);
      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteFeePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.deleteFeePlan(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Course deleted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // STUDENT FEES
  // ============================================================================

  async assignStudentFee(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = assignStudentFeeSchema.parse(req.body);
      const studentFee = await feeService.assignStudentFee(validated);
      res.status(201).json({
        success: true,
        data: studentFee,
      });
    } catch (err) {
      next(err);
    }
  }

  async listStudentFees(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as StudentFeeStatus | undefined,
        billingPeriod: req.query.billingPeriod as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      };

      const fees = await feeService.listStudentFees(filters);
      res.status(200).json({
        success: true,
        data: fees,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStudentFeeById(req: Request, res: Response, next: NextFunction) {
    try {
      const fee = await feeService.getStudentFeeById(req.params.id);
      res.status(200).json({
        success: true,
        data: fee,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStudentFee(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateStudentFeeSchema.parse(req.body);
      const fee = await feeService.updateStudentFee(req.params.id, validated);
      res.status(200).json({
        success: true,
        data: fee,
      });
    } catch (err) {
      next(err);
    }
  }

  async syncMonthlyFees(req: Request, res: Response, next: NextFunction) {
    try {
      const targetPeriod = req.body?.billingPeriod || (typeof req.query.billingPeriod === 'string' ? req.query.billingPeriod : undefined);
      const result = await feeService.syncMonthlyFeesForAllStudents(targetPeriod);
      res.status(200).json({
        success: true,
        message: `Monthly fees successfully synced for period ${result.syncedPeriod}. Generated ${result.createdCount} new billing records.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const feeController = new FeeController();
