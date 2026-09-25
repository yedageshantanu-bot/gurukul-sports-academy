import { Request, Response, NextFunction } from 'express';
import { TeacherService } from '../services/teacher.service.js';
import { createTeacherSchema, updateTeacherSchema } from '../types/crm.types.js';
import { AppError } from '../middlewares/errorHandler.js';

export class TeacherController {
  static async listTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const data = await TeacherService.listTeachers({ search, status });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Teacher ID is required', 400);

      const data = await TeacherService.getTeacherById(id, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await TeacherService.createTeacher(parsed.data);
      res.status(201).json({
        success: true,
        message: 'Teacher created successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Teacher ID is required', 400);

      const parsed = updateTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await TeacherService.updateTeacher(id, parsed.data);
      res.status(200).json({
        success: true,
        message: 'Teacher updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Teacher ID is required', 400);

      const targetStatus = req.body?.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      const data = await TeacherService.setTeacherStatus(id, targetStatus);

      res.status(200).json({
        success: true,
        message: `Teacher ${targetStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Teacher ID is required', 400);

      const data = await TeacherService.deleteTeacher(id);
      res.status(200).json({
        success: true,
        message: 'Teacher deleted successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
