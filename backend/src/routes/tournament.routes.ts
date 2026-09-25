import { Router } from 'express';
import { TournamentController } from '../controllers/tournament.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

router.get('/', TournamentController.list);
router.post('/', TournamentController.create);
router.get('/:id', TournamentController.getDetails);
router.get('/:id/registrations', TournamentController.getDetails);
router.post('/:id/select-students', TournamentController.nominate);
router.post('/:id/nominate', TournamentController.nominate);
router.patch('/registrations/:id', TournamentController.settle);
router.patch('/registrations/:id/payment', TournamentController.settle);
router.delete('/registrations/:id', TournamentController.remove);

export default router;
