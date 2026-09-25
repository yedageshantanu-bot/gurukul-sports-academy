import { Router } from 'express';
import { PublicationController } from '../controllers/publication.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

router.get('/', PublicationController.list);
router.post('/', PublicationController.create);
router.patch('/:id', PublicationController.update);
router.post('/:id/fee', PublicationController.recordFee);
router.post('/:id/whatsapp-reminder', PublicationController.sendReminder);

export default router;
