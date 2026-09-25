import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All settings routes require authentication
router.use(verifyAuth);

// Get academy profile / branding (supports both / and /academy)
router.get(['/', '/academy'], (req, res, next) => settingsController.getSettings(req, res, next));

// Update academy profile / branding (Admin & Demo Admin - supports PUT & PATCH on / and /academy)
router.put(['/', '/academy'], requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => settingsController.updateSettings(req, res, next));
router.patch(['/', '/academy'], requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => settingsController.updateSettings(req, res, next));

export default router;
