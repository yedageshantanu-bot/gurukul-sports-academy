import { Request, Response, NextFunction } from 'express';
import { PublicationService } from '../services/publication.service.js';

export class PublicationController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, feeStatus, deliveryStatus, academicYear, isExternal } = req.query;
      const data = await PublicationService.listPublicationStudents({
        search: search ? String(search) : undefined,
        feeStatus: feeStatus ? String(feeStatus) : undefined,
        deliveryStatus: deliveryStatus ? String(deliveryStatus) : undefined,
        academicYear: academicYear ? String(academicYear) : undefined,
        isExternal: isExternal !== undefined ? isExternal === 'true' : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await PublicationService.createPublicationStudent(req.body);
      res.status(201).json({ success: true, message: 'Publication student registered successfully', data: student });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await PublicationService.updatePublicationStudent(req.params.id, req.body);
      res.status(200).json({ success: true, message: 'Publication student updated successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async recordFee(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, paymentMethod, notes } = req.body;
      const updated = await PublicationService.recordPublicationFee(
        req.params.id,
        Number(amount),
        paymentMethod || 'UPI',
        notes
      );
      res.status(200).json({ success: true, message: 'Publication fee recorded successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async sendReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PublicationService.sendRenewalReminder(req.params.id);
      res.status(200).json({ success: true, message: result.message });
    } catch (err) {
      next(err);
    }
  }
}
