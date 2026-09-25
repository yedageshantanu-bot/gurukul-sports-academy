import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const passwordResetSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
});

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await authService.login(validated);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    // Client clears local session/token
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }

  async passwordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = passwordResetSchema.parse(req.body);
      const result = await authService.requestPasswordReset(validated);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  }
}

export const authController = new AuthController();
