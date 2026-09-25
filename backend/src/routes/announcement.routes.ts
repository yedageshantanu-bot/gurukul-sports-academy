import { Router } from 'express';
import { announcementController } from '../controllers/announcement.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All announcement routes require authentication
router.use(verifyAuth);

// List announcements (Admin gets all, Teacher gets announcements for assigned batches)
router.get('/', (req, res, next) => announcementController.listAnnouncements(req, res, next));
router.get('/:id', (req, res, next) => announcementController.getAnnouncementById(req, res, next));

// Create, update, send, and delete announcements (Admin & Demo Admin)
router.post('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.createAnnouncement(req, res, next));
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateAnnouncement(req, res, next));
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateAnnouncement(req, res, next));
router.delete('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.deleteAnnouncement(req, res, next));
router.post('/:id/send', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.sendAnnouncement(req, res, next));

export default router;
