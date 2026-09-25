import { Request, Response, NextFunction } from 'express';
import { RankService } from '../services/rank.service.js';

export class RankController {
  static async getDisciplines(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await RankService.getDisciplinesWithRanks();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createRank(req: Request, res: Response, next: NextFunction) {
    try {
      const rank = await RankService.createRank(req.body);
      res.status(201).json({ success: true, message: 'Rank created successfully', data: rank });
    } catch (err) {
      next(err);
    }
  }

  static async listStudentRanks(req: Request, res: Response, next: NextFunction) {
    try {
      const { discipline } = req.query;
      const data = await RankService.listStudentRanks(discipline ? String(discipline) : undefined);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async promote(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RankService.promoteStudent(req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCertificates(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, discipline, studentId } = req.query;
      const data = await RankService.getCertificateRegistry({
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        disciplineCode: discipline ? String(discipline) : undefined,
        studentId: studentId ? String(studentId) : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getAllRanks(req: Request, res: Response, next: NextFunction) {
    try {
      const { discipline } = req.query;
      const data = await RankService.getAllRanks(discipline ? String(discipline) : undefined);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async assignStudentRank(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RankService.assignStudentRank(req.body);
      res.status(201).json({ success: true, message: 'Student assigned to martial arts discipline', data: result });
    } catch (err) {
      next(err);
    }
  }
}
