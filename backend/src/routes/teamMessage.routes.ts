import { Router } from 'express';
import { teamMessageController } from '../controllers/teamMessage.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Allow authenticated users to view, send, and manage personal team messages
router.use(verifyAuth);

router.get('/', (req, res, next) => teamMessageController.listTeamMessages(req, res, next));
router.post('/', (req, res, next) => teamMessageController.createTeamMessage(req, res, next));
router.delete('/:id', (req, res, next) => teamMessageController.deleteTeamMessage(req, res, next));

export default router;
