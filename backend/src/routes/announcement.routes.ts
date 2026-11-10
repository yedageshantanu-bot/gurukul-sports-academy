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

// Unified Scheduling Delivery Slots endpoints (MUST be defined before /:id)
router.get('/slots', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), (req, res, next) => announcementController.listSlots(req, res, next));
router.get('/slots/:slotId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), (req, res, next) => announcementController.getSlotById(req, res, next));
router.post('/slots/:slotId/postpone', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.postponeSlot(req, res, next));
router.post('/slots/:slotId/reschedule', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.rescheduleSlot(req, res, next));
router.post('/slots/:slotId/send-now', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.sendSlotNow(req, res, next));
router.delete('/slots/:slotId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.cancelSlot(req, res, next));

// Scheduled announcements endpoints (MUST be defined before /:id)
router.get('/scheduled', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN, ROLES.TEACHER), (req, res, next) => announcementController.listScheduled(req, res, next));
router.patch('/scheduled/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateScheduled(req, res, next));
router.put('/scheduled/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateScheduled(req, res, next));
router.delete('/scheduled/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.deleteScheduled(req, res, next));
router.post('/scheduled/:id/send-now', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.dispatchScheduledNow(req, res, next));

router.get('/:id', (req, res, next) => announcementController.getAnnouncementById(req, res, next));

// Create, update, send, and delete announcements (Admin & Demo Admin)
router.post('/', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.createAnnouncement(req, res, next));
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateAnnouncement(req, res, next));
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.updateAnnouncement(req, res, next));
router.delete('/:id', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.deleteAnnouncement(req, res, next));
router.post('/:id/send', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => announcementController.sendAnnouncement(req, res, next));

export default router;
