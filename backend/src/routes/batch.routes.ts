import { Router } from 'express';
import { BatchController } from '../controllers/batch.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);

// Assignment endpoints: Admin or Demo Admin
router.post('/:batchId/teachers/:teacherId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.assignTeacher);
router.delete('/:batchId/teachers/:teacherId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.removeTeacher);
router.post('/:batchId/students/:studentId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.assignStudent);
router.delete('/:batchId/students/:studentId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.removeStudent);

// Batch mutation endpoints: Admin or Demo Admin
router.post('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.createBatch);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.updateBatch);
router.post('/:id/deactivate', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.deactivateBatch);
router.delete('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), BatchController.deleteBatch);

// Read endpoints: Admin, Demo Admin, or Teacher
router.get('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), BatchController.listBatches);
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), BatchController.getBatchById);

export default router;
