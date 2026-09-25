import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Public auth endpoints
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/password-reset', (req, res, next) => authController.passwordReset(req, res, next));

// Authenticated session context check
router.get('/me', verifyAuth, (req, res) => authController.getCurrentUser(req, res));

export default router;
