import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { joinGroup, leaveGroup } from '../controllers/groupController';

const router = Router();

router.post('/join', verifyAuth, joinGroup);
router.post('/:id/leave', verifyAuth, leaveGroup);

export default router;
