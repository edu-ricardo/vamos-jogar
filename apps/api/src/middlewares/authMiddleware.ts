import { Request, Response, NextFunction } from 'express';
import { createUserClient } from '../lib/pocketbase';
import { verifyUserToken } from '../services/userTokenService';

export const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    (req as any).user = await verifyUserToken(createUserClient(token));
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
