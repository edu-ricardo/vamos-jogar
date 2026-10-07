import { Request, Response } from 'express';
import { getAdminClient } from '../lib/pocketbase';
import { joinGroupByInvite } from '../services/groupInviteService';
import { accountService } from '../services/accountService';

const JOIN_ERRORS = {
  INVALID_INVITE: { status: 404, error: 'Convite inválido ou expirado.' },
  ALREADY_MEMBER: { status: 400, error: 'Você já é membro deste grupo.' },
} as const;

export const joinGroup = async (req: Request, res: Response) => {
  const { inviteToken } = req.body;

  if (!inviteToken) {
    return res.status(400).json({ error: 'inviteToken é obrigatório.' });
  }

  try {
    const result = await joinGroupByInvite(await getAdminClient(), inviteToken, (req as any).user);
    if (!result.ok) {
      const { status, error } = JOIN_ERRORS[result.reason];
      return res.status(status).json({ error });
    }
    return res.json({ success: true, groupId: result.groupId, groupName: result.groupName });
  } catch (error) {
    console.error('Erro ao entrar no grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao processar o convite.' });
  }
};

export const leaveGroup = async (req: Request, res: Response) => {
  try {
    const result = await accountService.leaveGroup((req as any).user.uid, String(req.params.id));
    if (!result.ok) return res.status(404).json({ error: 'Você não é membro deste grupo.' });
    return res.json({ success: true, groupDeleted: result.groupDeleted });
  } catch (error) {
    console.error('Erro ao sair do grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao sair do grupo.' });
  }
};
