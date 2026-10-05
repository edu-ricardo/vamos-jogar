import { NextFunction, Request, Response, Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { adminService } from '../services/adminService';
import {
  deleteUser,
  getStatus,
  listGroups,
  listLogs,
  listUsers,
  removeMember,
  setAdmin,
  setTemporaryPassword,
  transferGroupAdmin,
} from '../controllers/adminController';

// Só admins do app passam; vem depois do verifyAuth
const requireAppAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (await adminService.isAppAdmin((req as any).user)) return next();
    return res.status(403).json({ error: 'Acesso restrito aos administradores do app.' });
  } catch (error) {
    console.error('Erro ao verificar admin do app:', error);
    return res.status(500).json({ error: 'Erro ao verificar permissão.' });
  }
};

const router = Router();

// Qualquer pessoa logada pode perguntar se é admin (o app mostra ou não o menu)
router.get('/status', verifyAuth, getStatus);

router.use(verifyAuth, requireAppAdmin);
router.get('/users', listUsers);
router.post('/users/:id/temporary-password', setTemporaryPassword);
router.post('/users/:id/admin', setAdmin);
router.delete('/users/:id', deleteUser);
router.get('/groups', listGroups);
router.post('/groups/:id/admin', transferGroupAdmin);
router.delete('/groups/:id/members/:userId', removeMember);
router.get('/logs', listLogs);

export default router;
