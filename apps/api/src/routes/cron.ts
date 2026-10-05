import { Router } from 'express';
import { cronController } from '../controllers/cronController';
import { verifyAuth } from '../middlewares/authMiddleware';

const router = Router();

// Botão "Cobrar Atrasados"; os lembretes automáticos rodam no agendador interno da API
router.post('/force-event-reminders', verifyAuth, cronController.forceRemindersForEvent);

export default router;
