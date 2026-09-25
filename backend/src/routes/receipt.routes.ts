import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All receipt routes require authentication (Admin & Demo Admin)
router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

router.get('/:id', (req, res, next) => receiptController.getReceiptById(req, res, next));
router.get('/:id/pdf', (req, res, next) => receiptController.getReceiptPdf(req, res, next));

export default router;
