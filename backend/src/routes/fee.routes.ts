import { Router } from 'express';
import { feeController } from '../controllers/fee.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// Strictly protect all fee management endpoints to ADMIN and DEMO_ADMIN roles
router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

// ==============================================================================
// FEE PLANS
// ==============================================================================
router.get('/plans', feeController.listFeePlans);
router.post('/plans', feeController.createFeePlan);
router.get('/plans/:id', feeController.getFeePlanById);
router.patch('/plans/:id', feeController.updateFeePlan);
router.post('/plans/:id/activate', feeController.activateFeePlan);
router.post('/plans/:id/deactivate', feeController.deactivateFeePlan);

// ==============================================================================
// STUDENT FEES
// ==============================================================================
router.get('/students', feeController.listStudentFees);
router.post('/students', feeController.assignStudentFee);
router.get('/students/:id', feeController.getStudentFeeById);
router.patch('/students/:id', feeController.updateStudentFee);

// Documented generic aliases (/fees -> student fees)
router.get('/', feeController.listStudentFees);
router.post('/', feeController.assignStudentFee);
router.get('/:id', feeController.getStudentFeeById);
router.patch('/:id', feeController.updateStudentFee);

export default router;
