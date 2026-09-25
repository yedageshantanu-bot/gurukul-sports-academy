import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);

router.get('/admin', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), DashboardController.getAdminDashboard);
router.get('/teacher', requireRole(ROLES.TEACHER), DashboardController.getTeacherDashboard);

export default router;
