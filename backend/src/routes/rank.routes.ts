import { Router } from 'express';
import { RankController } from '../controllers/rank.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(verifyAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.DEMO_ADMIN));

router.get('/disciplines', RankController.getDisciplines);
router.get('/list', RankController.getAllRanks);
router.post('/', RankController.createRank);
router.get('/students', RankController.listStudentRanks);
router.post('/assign', RankController.assignStudentRank);
router.post('/promote', RankController.promote);
router.get('/certificates', RankController.getCertificates);

export default router;
