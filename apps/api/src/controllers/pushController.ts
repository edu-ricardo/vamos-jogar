import { Request, Response } from 'express';
import { getVapidPublicKey, prefsService, pushService } from '../services/notifications';
import { parsePrefsChange } from '../services/notificationPrefs';
import { isValidSubscription } from '../services/pushService';

export const getPublicKey = (_req: Request, res: Response) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey)
    return res.status(503).json({ error: 'Notificações não configuradas no servidor.' });
  return res.json({ publicKey });
};

export const subscribe = async (req: Request, res: Response) => {
  const { subscription } = req.body;
  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'Inscrição de notificação inválida.' });
  }
  try {
    await pushService.subscribe((req as any).user.uid, subscription, req.get('user-agent'));
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao salvar inscrição de notificação:', error);
    return res.status(500).json({ error: 'Erro ao ativar as notificações.' });
  }
};

export const unsubscribe = async (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (typeof endpoint !== 'string' || !endpoint) {
    return res.status(400).json({ error: 'endpoint é obrigatório.' });
  }
  try {
    await pushService.unsubscribe((req as any).user.uid, endpoint);
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao remover inscrição de notificação:', error);
    return res.status(500).json({ error: 'Erro ao desativar as notificações.' });
  }
};

// O que a pessoa quer receber (vale em todos os aparelhos dela)
export const getPreferences = async (req: Request, res: Response) => {
  try {
    return res.json(await prefsService.get((req as any).user.uid));
  } catch (error) {
    console.error('Erro ao carregar preferências de notificação:', error);
    return res.status(500).json({ error: 'Erro ao carregar as preferências.' });
  }
};

export const setPreferences = async (req: Request, res: Response) => {
  const change = parsePrefsChange(req.body);
  if (!change) return res.status(400).json({ error: 'Preferências inválidas.' });
  try {
    return res.json(await prefsService.set((req as any).user.uid, change));
  } catch (error) {
    console.error('Erro ao salvar preferências de notificação:', error);
    return res.status(500).json({ error: 'Erro ao salvar as preferências.' });
  }
};
