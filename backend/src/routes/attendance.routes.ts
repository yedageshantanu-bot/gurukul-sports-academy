import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);

// Attendance sheet prefill for marking
router.get('/sheet', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), AttendanceController.getBatchAttendanceSheet);

// Bulk mark / upsert attendance
router.post('/bulk', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), AttendanceController.markBulkAttendance);

// List attendance records
router.get('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), AttendanceController.listAttendance);

// Single record correction
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), AttendanceController.updateAttendanceRecord);

export default router;
