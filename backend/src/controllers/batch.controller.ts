import { Request, Response, NextFunction } from 'express';
import { BatchService } from '../services/batch.service.js';
import { createBatchSchema, updateBatchSchema } from '../types/crm.types.js';
import { AppError } from '../middlewares/errorHandler.js';

export class BatchController {
  static async listBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const data = await BatchService.listBatches({ search, status }, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBatchById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Batch ID is required', 400);

      const data = await BatchService.getBatchById(id, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await BatchService.createBatch(parsed.data);
      res.status(201).json({
        success: true,
        message: 'Batch created successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Batch ID is required', 400);

      const parsed = updateBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await BatchService.updateBatch(id, parsed.data);
      res.status(200).json({
        success: true,
        message: 'Batch updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Batch ID is required', 400);

      const targetStatus = req.body?.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      const data = await BatchService.setBatchStatus(id, targetStatus);

      res.status(200).json({
        success: true,
        message: `Batch ${targetStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, teacherId } = req.params;
      if (!batchId || !teacherId) throw new AppError('batchId and teacherId are required', 400);

      const data = await BatchService.assignTeacher(batchId, teacherId);
      res.status(200).json({
        success: true,
        message: 'Teacher assigned to batch successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, teacherId } = req.params;
      if (!batchId || !teacherId) throw new AppError('batchId and teacherId are required', 400);

      const data = await BatchService.removeTeacher(batchId, teacherId);
      res.status(200).json({
        success: true,
        message: 'Teacher removed from batch successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, studentId } = req.params;
      if (!batchId || !studentId) throw new AppError('batchId and studentId are required', 400);

      const data = await BatchService.assignStudent(batchId, studentId);
      res.status(200).json({
        success: true,
        message: 'Student assigned to batch successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, studentId } = req.params;
      if (!batchId || !studentId) throw new AppError('batchId and studentId are required', 400);

      const data = await BatchService.removeStudent(batchId, studentId);
      res.status(200).json({
        success: true,
        message: 'Student removed from batch successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Batch ID is required', 400);

      const data = await BatchService.deleteBatch(id);
      res.status(200).json({
        success: true,
        message: 'Batch deleted successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
