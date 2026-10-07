import { Request, Response } from 'express';
import { attendanceService, eventNotificationService } from '../services/notifications';
import { isAnnounceKind } from '../services/eventNotificationRules';
import { isAttendanceStatus } from '../services/attendanceService';

const uid = (req: Request): string => (req as any).user.uid;

const ANNOUNCE_ERRORS = {
  EVENT_NOT_FOUND: { status: 404, error: 'Evento não encontrado.' },
  FORBIDDEN: { status: 403, error: 'Só quem criou o evento ou o admin do grupo pode avisar.' },
  WRONG_STATE: { status: 409, error: 'O evento não está nesta etapa.' },
  ALREADY_SENT: { status: 409, error: 'Este aviso já foi enviado.' },
} as const;

const ATTENDANCE_ERRORS = {
  EVENT_NOT_FOUND: { status: 404, error: 'Evento não encontrado.' },
  NOT_MEMBER: { status: 403, error: 'Você não participa deste grupo.' },
  NOT_OPEN: { status: 409, error: 'A data do evento ainda não foi definida.' },
} as const;

// Avisa o grupo depois de uma ação do organizador (evento novo, data definida, jogatina confirmada)
export const announce = async (req: Request, res: Response) => {
  const { kind } = req.body ?? {};
  if (!isAnnounceKind(kind)) {
    return res.status(400).json({ error: 'kind deve ser created, date_set ou confirmed.' });
  }
  try {
    const result = await eventNotificationService.announce(String(req.params.id), kind, uid(req));
    if (!result.ok) {
      const { status, error } = ANNOUNCE_ERRORS[result.reason];
      return res.status(status).json({ error });
    }
    return res.json({ success: true, recipients: result.recipients, notified: result.notified });
  } catch (error) {
    console.error('Erro ao avisar o grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao enviar o aviso.' });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  try {
    const result = await attendanceService.list(String(req.params.id), uid(req));
    if (!result.ok) {
      const { status, error } = ATTENDANCE_ERRORS[result.reason];
      return res.status(status).json({ error });
    }
    return res.json({ answers: result.answers });
  } catch (error) {
    console.error('Erro ao carregar presenças:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar as presenças.' });
  }
};

export const setAttendance = async (req: Request, res: Response) => {
  const { status } = req.body ?? {};
  if (!isAttendanceStatus(status)) {
    return res.status(400).json({ error: 'status deve ser yes, no ou maybe.' });
  }
  try {
    const result = await attendanceService.set(String(req.params.id), uid(req), status);
    if (!result.ok) {
      const { status: code, error } = ATTENDANCE_ERRORS[result.reason];
      return res.status(code).json({ error });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao salvar presença:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar a presença.' });
  }
};
