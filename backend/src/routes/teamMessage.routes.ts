import { Router } from 'express';
import { teamMessageController } from '../controllers/teamMessage.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Allow authenticated users to view, send, and manage personal team messages
router.use(verifyAuth);

// Team categories / groups
router.get('/teams', (req, res, next) => teamMessageController.listTeams(req, res, next));
router.post('/teams', (req, res, next) => teamMessageController.createTeam(req, res, next));
router.delete('/teams/:id', (req, res, next) => teamMessageController.deleteTeam(req, res, next));

// Team members roster
router.get('/members', (req, res, next) => teamMessageController.listTeamMembers(req, res, next));
router.post('/members', (req, res, next) => teamMessageController.createTeamMember(req, res, next));
router.delete('/members/:id', (req, res, next) => teamMessageController.deleteTeamMember(req, res, next));

// Team messages
router.get('/', (req, res, next) => teamMessageController.listTeamMessages(req, res, next));
router.post('/', (req, res, next) => teamMessageController.createTeamMessage(req, res, next));
router.delete('/:id', (req, res, next) => teamMessageController.deleteTeamMessage(req, res, next));

export default router;
