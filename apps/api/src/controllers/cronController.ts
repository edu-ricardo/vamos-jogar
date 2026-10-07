import { Request, Response } from 'express';
import { reminderService } from '../services/notifications';
import { describeReminderOutcome } from '../services/reminderRules';

const FORCE_ERRORS = {
  EVENT_NOT_FOUND: { status: 404, error: 'Evento não encontrado.' },
  FORBIDDEN: { status: 403, error: 'Só quem criou o evento ou o admin do grupo pode cobrar.' },
  EVENT_CONFIRMED: { status: 400, error: 'O evento já foi confirmado.' },
} as const;

export const cronController = {
  // Botão "Cobrar Atrasados": avisa agora quem ainda não votou
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
      const message = describeReminderOutcome(result.pending, result.notified);
      return res.status(200).json({ success: true, message });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
