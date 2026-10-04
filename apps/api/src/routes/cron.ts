import { Router } from 'express';
import { cronController } from '../controllers/cronController';
import { verifyAuth } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint chamado pelo Cron-job.org
router.get('/process-reminders', cronController.processReminders);
router.post('/process-reminders', cronController.processReminders);

// Endpoint chamado pelo botão do frontend
router.post('/force-event-reminders', verifyAuth, cronController.forceRemindersForEvent);

export default router;
