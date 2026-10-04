import { Request, Response } from 'express';
import { accountService } from '../services/accountService';
import { isRecentLogin } from '../services/accountRules';

export const deleteAccount = async (req: Request, res: Response) => {
  const { uid, auth_time } = (req as any).user;

  if (!isRecentLogin(auth_time, new Date())) {
    return res
      .status(403)
      .json({ error: 'Login recente necessário.', code: 'requires-recent-login' });
  }

  try {
    await accountService.deleteAccount(uid);
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir a conta.' });
  }
};
