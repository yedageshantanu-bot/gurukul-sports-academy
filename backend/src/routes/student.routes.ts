import { Router } from 'express';
import { StudentController } from '../controllers/student.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);

// Student mutation endpoints: Admin, Demo Admin, or Teacher
router.post('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), StudentController.createStudent);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), StudentController.updateStudent);
router.post('/:id/deactivate', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), StudentController.deactivateStudent);
router.delete('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), StudentController.deleteStudent);

// Read endpoints: Admin, Demo Admin, or Teacher
router.get('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), StudentController.listStudents);
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), StudentController.getStudentById);

export default router;
