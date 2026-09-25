import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All teacher routes require verified authentication
router.use(verifyAuth);

// Admin & Demo Admin endpoints
router.get('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), TeacherController.listTeachers);
router.post('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), TeacherController.createTeacher);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), TeacherController.updateTeacher);
router.post('/:id/deactivate', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), TeacherController.deactivateTeacher);
router.delete('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), TeacherController.deleteTeacher);

// View teacher by ID: Admin, Demo Admin, or Teacher themself
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), TeacherController.getTeacherById);

export default router;
