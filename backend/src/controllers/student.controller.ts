import { Request, Response, NextFunction } from 'express';
import { StudentService } from '../services/student.service.js';
import { createStudentSchema, updateStudentSchema } from '../types/crm.types.js';
import { AppError } from '../middlewares/errorHandler.js';

export class StudentController {
  static async listStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;

      const data = await StudentService.listStudents({ search, status, batchId }, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Student ID is required', 400);

      const data = await StudentService.getStudentById(id, req.user!);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await StudentService.createStudent(parsed.data);
      res.status(201).json({
        success: true,
        message: 'Student created successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Student ID is required', 400);

      const parsed = updateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await StudentService.updateStudent(id, parsed.data);
      res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Student ID is required', 400);

      const targetStatus = req.body?.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      const data = await StudentService.setStudentStatus(id, targetStatus);

      res.status(200).json({
        success: true,
        message: `Student ${targetStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Student ID is required', 400);

      const data = await StudentService.deleteStudent(id);
      res.status(200).json({
        success: true,
        message: 'Student deleted successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
