import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All report routes require authentication
router.use(verifyAuth);

// Attendance reports (Accessible by Admin and assigned Teacher)
router.get('/attendance', (req, res, next) => reportController.getAttendanceReport(req, res, next));
router.get('/attendance/export', (req, res, next) => reportController.exportAttendanceCsv(req, res, next));

// Financial reports (Admin & Demo Admin)
router.get('/fees', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => reportController.getFeesReport(req, res, next));
router.get('/fees/export', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => reportController.exportFeesCsv(req, res, next));

router.get('/payments', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => reportController.getPaymentsReport(req, res, next));
router.get('/payments/export', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => reportController.exportPaymentsCsv(req, res, next));

export default router;
