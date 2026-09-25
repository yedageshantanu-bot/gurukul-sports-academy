import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  recordManualPaymentSchema,
  PaymentStatus,
  PaymentProviderType,
} from '../types/fee.types.js';

export class PaymentController {
  async createPaymentOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createPaymentOrderSchema.parse(req.body);
      const result = await paymentService.createPaymentOrder(validated);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyPaymentSchema.parse(req.body);
      const result = await paymentService.verifyPayment(validated);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async recordManualPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = recordManualPaymentSchema.parse(req.body);
      const result = await paymentService.recordManualPayment(validated);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as PaymentStatus | undefined,
        provider: req.query.provider as PaymentProviderType | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const payments = await paymentService.listPayments(filters);
      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.getPaymentById(req.params.id);
      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      const rawBody = JSON.stringify(req.body);
      const result = await paymentService.handleWebhook(rawBody, signature, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
