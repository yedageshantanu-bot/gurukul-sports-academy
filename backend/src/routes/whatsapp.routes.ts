import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

import { env } from '../config/env.js';

const router = Router();

// 1. Environment barrier: disable WhatsApp endpoints only if WhatsApp is explicitly turned off
router.use((_req, res, next) => {
  if (!env.WHATSAPP_ENABLED) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'WhatsApp automation is disabled in this environment.',
      },
    });
  }
  next();
});

// 2. Authentication
router.use(verifyAuth);

// ==============================================================================
// 1. STATUS & DEVICE MANAGEMENT
// ==============================================================================
router.get('/status', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.getStatus(req, res, next));
router.post('/connect', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.connectDevice(req, res, next));
router.post('/reconnect', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.reconnectDevice(req, res, next));
router.post('/disconnect', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.disconnectDevice(req, res, next));

// ==============================================================================
// 2. SETTINGS, CONTROLS & OPT-IN
// ==============================================================================
router.get('/settings', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.getSettings(req, res, next));
router.patch('/settings', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.updateSettings(req, res, next));
router.post('/emergency-stop', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.toggleEmergencyStop(req, res, next));
router.post('/opt-in', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.updateOptIn(req, res, next));

// ==============================================================================
// 3. MESSAGE QUEUE
// ==============================================================================
router.get('/queue', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.listQueue(req, res, next));
router.post('/queue', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.enqueueMessage(req, res, next));
router.post('/queue/process', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.processQueue(req, res, next));
router.post('/messages/:id/retry', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.retryMessage(req, res, next));

// ==============================================================================
// 4. MESSAGE LOGS & OUTBOX
// ==============================================================================
router.get('/logs', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.listLogs(req, res, next));
router.get('/messages', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.listMessages(req, res, next));
router.post('/send', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.sendCustomMessage(req, res, next));
router.post('/trigger-fee-reminder', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.triggerFeeReminder(req, res, next));
router.post('/remind/monthly-fees', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.triggerMonthlyFeeReminders(req, res, next));
router.post('/reports/send-student/:studentId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.sendStudentMonthlyReport(req, res, next));
router.post('/reports/send-all', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.sendAllMonthlyReports(req, res, next));
router.get('/reports/download-pdf/:studentId', requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN), (req, res, next) => whatsappController.downloadStudentReportPdf(req, res, next));

// ==============================================================================
// 5. TEMPLATES
// ==============================================================================
router.get('/templates', (req, res, next) => whatsappController.listTemplates(req, res, next));
router.post('/templates', (req, res, next) => whatsappController.createTemplate(req, res, next));
router.get('/templates/:id', (req, res, next) => whatsappController.getTemplateById(req, res, next));
router.patch('/templates/:id', (req, res, next) => whatsappController.updateTemplate(req, res, next));
router.post('/templates/:id/activate', (req, res, next) => whatsappController.activateTemplate(req, res, next));
router.post('/templates/:id/deactivate', (req, res, next) => whatsappController.deactivateTemplate(req, res, next));

export default router;
