import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { deleteAccount } from '../controllers/accountController';

const router = Router();

router.delete('/', verifyAuth, deleteAccount);

export default router;
