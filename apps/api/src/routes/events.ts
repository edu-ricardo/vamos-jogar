import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { announce, getAttendance, setAttendance } from '../controllers/eventController';

const router = Router();

router.post('/:id/announce', verifyAuth, announce);
router.get('/:id/attendance', verifyAuth, getAttendance);
router.put('/:id/attendance', verifyAuth, setAttendance);

export default router;
