import { Request, Response } from 'express';
import { AdminActionError, adminService } from '../services/adminService';

const actor = (req: Request) => (req as any).user;

// Erros previstos voltam com a mensagem; o resto vira 500 com log
const run =
  (label: string, action: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof AdminActionError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error(`Erro no painel de admin (${label}):`, error);
      return res.status(500).json({ error: 'Erro interno no painel de admin.' });
    }
  };

export const getStatus = run('status', async (req, res) => {
  res.json({ isAdmin: await adminService.isAppAdmin(actor(req)) });
});

export const listUsers = run('usuários', async (_req, res) => {
  res.json(await adminService.listUsers());
});

export const setTemporaryPassword = run('senha temporária', async (req, res) => {
  res.json({
    password: await adminService.setTemporaryPassword(actor(req), String(req.params.id)),
  });
});

export const setAdmin = run('acesso de admin', async (req, res) => {
  if (typeof req.body?.isAdmin !== 'boolean') {
    throw new AdminActionError('isAdmin deve ser verdadeiro ou falso.');
  }
  await adminService.setAdmin(actor(req), String(req.params.id), req.body.isAdmin);
  res.status(204).send();
});

export const deleteUser = run('exclusão de conta', async (req, res) => {
  await adminService.deleteUser(actor(req), String(req.params.id));
  res.status(204).send();
});

export const listGroups = run('grupos', async (_req, res) => {
  res.json(await adminService.listGroups());
});

export const transferGroupAdmin = run('admin do grupo', async (req, res) => {
  if (typeof req.body?.userId !== 'string' || !req.body.userId) {
    throw new AdminActionError('userId é obrigatório.');
  }
  await adminService.transferGroupAdmin(actor(req), String(req.params.id), req.body.userId);
  res.status(204).send();
});

export const removeMember = run('remoção de membro', async (req, res) => {
  await adminService.removeMember(actor(req), String(req.params.id), String(req.params.userId));
  res.status(204).send();
});

export const listLogs = run('registro', async (_req, res) => {
  res.json(await adminService.listLogs());
});
