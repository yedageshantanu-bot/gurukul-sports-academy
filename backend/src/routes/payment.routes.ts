import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// Webhook endpoint (unauthenticated, verified via provider HMAC signature)
router.post('/webhook', paymentController.handleWebhook);

// Protected endpoints (Admin & Demo Admin)
router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

router.get('/', paymentController.listPayments);
router.get('/:id', paymentController.getPaymentById);

// Order creation (both /order and /create supported as documented)
router.post('/order', paymentController.createPaymentOrder);
router.post('/create', paymentController.createPaymentOrder);

// Server-side payment verification
router.post('/verify', paymentController.verifyPayment);

// Manual cash/offline payment recording
router.post('/manual', paymentController.recordManualPayment);

export default router;
