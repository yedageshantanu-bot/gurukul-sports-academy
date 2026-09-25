import { Request, Response, NextFunction } from 'express';
import { receiptService } from '../services/receipt.service.js';

export class ReceiptController {
  // ============================================================================
  // 1. GET RECEIPT BY ID
  // ============================================================================
  async getReceiptById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await receiptService.getReceiptById(req.params.id);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 2. GET RECEIPT PRINTABLE VIEW / HTML
  // ============================================================================
  async getReceiptPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const html = await receiptService.getReceiptHtml(req.params.id);

      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }
}

export const receiptController = new ReceiptController();
