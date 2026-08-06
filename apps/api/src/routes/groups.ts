import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { joinGroup } from '../controllers/groupController';

const router = Router();

router.post('/join', verifyAuth, joinGroup);

export default router;
