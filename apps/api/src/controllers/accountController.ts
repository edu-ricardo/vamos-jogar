import { Request, Response } from 'express';
import { accountService } from '../services/accountService';

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    await accountService.deleteAccount((req as any).user.uid);
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir a conta.' });
  }
};
