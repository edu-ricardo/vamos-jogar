import { Request, Response } from 'express';
import { reminderService } from '../services/reminderService';

const FORCE_ERRORS = {
  EVENT_NOT_FOUND: { status: 404, error: 'Event not found' },
  FORBIDDEN: { status: 403, error: 'Only the event creator or group admin can send reminders' },
  EVENT_CONFIRMED: { status: 400, error: 'Event is already confirmed' },
} as const;

export const cronController = {
  processReminders: async (req: Request, res: Response) => {
    // Chave enviada pelo agendador; sem CRON_SECRET configurado a rota fica fechada
    const expectedKey = process.env.CRON_SECRET;
    const cronKey = req.headers['x-cron-key'] || req.query.key;

    if (!expectedKey || cronKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const sent = await reminderService.processScheduledReminders();
      return res.status(200).json({ success: true, message: `Reminders processed. Sent: ${sent}` });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  // Endpoint para o criador do evento forçar a notificação via botão do Frontend
  forceRemindersForEvent: async (req: Request, res: Response) => {
    const { groupId, eventId } = req.body;
    if (!groupId || !eventId) return res.status(400).json({ error: 'Missing parameters' });

    try {
      const result = await reminderService.sendRemindersForEvent(
        groupId,
        eventId,
        (req as any).user.uid,
      );
      if (!result.ok) {
        const { status, error } = FORCE_ERRORS[result.reason];
        return res.status(status).json({ error });
      }
      return res.status(200).json({ success: true, message: `Sent ${result.sent} reminders.` });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
