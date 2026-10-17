import { Request, Response, NextFunction } from 'express';
import { studentPortalService } from '../services/studentPortal.service.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { AppError } from '../middlewares/errorHandler.js';

export class StudentPortalController {
  /**
   * Public Student Login
   * POST /api/student-portal/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        throw new AppError('Registered mobile number and password are required.', 400);
      }

      const result = await studentPortalService.studentLogin(identifier, password);
      return res.status(200).json({
        success: true,
        message: 'Login successful! Welcome to Gurukul Sports Academy.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Student Profile
   * GET /api/student-portal/profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.studentId;
      if (!studentId) {
        throw new AppError('Student ID not found in session context.', 400);
      }

      const profile = await studentPortalService.getStudentProfile(studentId);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Student Attendance
   * GET /api/student-portal/attendance?year=2026&month=10
   */
  async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.studentId;
      if (!studentId) {
        throw new AppError('Student ID not found in session context.', 400);
      }

      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;

      const attendance = await studentPortalService.getStudentAttendance(studentId, year, month);
      return res.status(200).json({
        success: true,
        data: attendance,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Student Fees & Receipts
   * GET /api/student-portal/fees
   */
  async getFees(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.studentId;
      if (!studentId) {
        throw new AppError('Student ID not found in session context.', 400);
      }

      const fees = await studentPortalService.getStudentFees(studentId);
      return res.status(200).json({
        success: true,
        data: fees,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Academy Announcements for Student
   * GET /api/student-portal/announcements
   */
  async getAnnouncements(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.studentId;
      if (!studentId) {
        throw new AppError('Student ID not found in session context.', 400);
      }

      const announcements = await studentPortalService.getStudentAnnouncements(studentId);
      return res.status(200).json({
        success: true,
        data: announcements,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download Student Official PDF Receipt
   * GET /api/student-portal/receipt/:id/pdf
   */
  async downloadReceiptPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.studentId;
      const receiptId = req.params.id;

      if (!studentId) {
        throw new AppError('Student context required.', 401);
      }
      if (!receiptId) {
        throw new AppError('Receipt ID is required.', 400);
      }

      const { buffer, fileName } = await studentPortalService.getReceiptPdfBuffer(receiptId, studentId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Student Self Password Change
   * POST /api/student-portal/change-password
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const { newPassword } = req.body;
      if (!userId || !newPassword) {
        throw new AppError('New password is required.', 400);
      }

      const result = await studentPortalService.changePassword(userId, newPassword);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ADMIN ONBOARDING & CHASER CONTROLS
  // ==========================================

  /**
   * Send WhatsApp Invite to a Student
   * POST /api/student-portal/admin/invite/:id
   */
  async inviteStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.id;
      const { customPin } = req.body;
      const result = await automationService.triggerStudentInvite(studentId, customPin);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Run Onboarding Chaser Bot
   * POST /api/student-portal/admin/run-chaser
   */
  async runChaser(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await automationService.triggerStudentOnboardingChaser();
      return res.status(200).json({
        success: true,
        message: `Chaser scan completed! Reminded ${result.remindedCount} students.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List Onboarding Status of all students
   * GET /api/student-portal/admin/onboarding-status
   */
  async getOnboardingStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const list = await studentPortalService.listStudentsOnboardingStatus();
      return res.status(200).json({
        success: true,
        data: list,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get VAPID Public Key for Web Push
   * GET /api/student-portal/push-vapid-key
   */
  async getVapidPublicKey(_req: Request, res: Response, next: NextFunction) {
    try {
      const { VAPID_PUBLIC_KEY } = await import('../services/webpush.service.js');
      return res.status(200).json({
        success: true,
        data: { publicKey: VAPID_PUBLIC_KEY },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Register Web Push Subscription
   * POST /api/student-portal/push-subscribe
   */
  async subscribePush(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const { subscription } = req.body;
      if (!userId || !subscription) {
        throw new AppError('Subscription and user context required.', 400);
      }

      const { webPushService } = await import('../services/webpush.service.js');
      const result = await webPushService.saveSubscription(userId, subscription);

      // Trigger immediate confirmation push to the device
      await webPushService.sendNotificationToUser(userId, {
        title: 'Gurukul Sports Academy 🥋',
        body: 'Push notifications are now active on this device! Tap to view your dashboard.',
        url: '/student/dashboard',
      });

      return res.status(200).json({
        success: true,
        message: 'Push notifications enabled on this device!',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger Test Push Notification
   * POST /api/student-portal/test-push
   */
  async testPush(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('User context required.', 401);
      }

      const { webPushService } = await import('../services/webpush.service.js');
      const result = await webPushService.sendNotificationToUser(userId, {
        title: '🥋 Gurukul Sports Academy Alert',
        body: 'Success! Your mobile app push notifications are functioning perfectly.',
        url: '/student/dashboard',
      });

      return res.status(200).json({
        success: true,
        message: result.sentCount > 0 ? 'Push notification delivered to device!' : 'No active device subscription found.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const studentPortalController = new StudentPortalController();
