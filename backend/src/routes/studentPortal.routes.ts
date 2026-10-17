import { Router } from 'express';
import { studentPortalController } from '../controllers/studentPortal.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// ==========================================
// PUBLIC STUDENT AUTH
// ==========================================
router.post('/auth/login', (req, res, next) => studentPortalController.login(req, res, next));

// ==========================================
// STUDENT PROTECTED ROUTES
// ==========================================
router.get(
  '/profile',
  verifyAuth,
  requireRole(ROLES.STUDENT),
  (req, res, next) => studentPortalController.getProfile(req, res, next)
);

router.get(
  '/attendance',
  verifyAuth,
  requireRole(ROLES.STUDENT),
  (req, res, next) => studentPortalController.getAttendance(req, res, next)
);

router.get(
  '/fees',
  verifyAuth,
  requireRole(ROLES.STUDENT),
  (req, res, next) => studentPortalController.getFees(req, res, next)
);

router.get(
  '/announcements',
  verifyAuth,
  requireRole(ROLES.STUDENT),
  (req, res, next) => studentPortalController.getAnnouncements(req, res, next)
);

router.get(
  '/receipt/:id/pdf',
  verifyAuth,
  requireRole(ROLES.STUDENT, ROLES.ADMIN, ROLES.DEMO_ADMIN),
  (req, res, next) => studentPortalController.downloadReceiptPdf(req, res, next)
);

router.post(
  '/change-password',
  verifyAuth,
  requireRole(ROLES.STUDENT),
  (req, res, next) => studentPortalController.changePassword(req, res, next)
);

// ==========================================
// ADMIN ONBOARDING & CHASER CONTROLS
// ==========================================
router.post(
  '/admin/invite/:id',
  verifyAuth,
  requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN),
  (req, res, next) => studentPortalController.inviteStudent(req, res, next)
);

router.post(
  '/admin/run-chaser',
  verifyAuth,
  requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN),
  (req, res, next) => studentPortalController.runChaser(req, res, next)
);

router.get(
  '/admin/onboarding-status',
  verifyAuth,
  requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN),
  (req, res, next) => studentPortalController.getOnboardingStatus(req, res, next)
);

export default router;
