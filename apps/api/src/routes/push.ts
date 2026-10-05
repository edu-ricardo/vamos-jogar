import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { getPublicKey, subscribe, unsubscribe } from '../controllers/pushController';

const router = Router();

router.get('/public-key', getPublicKey);
router.post('/subscriptions', verifyAuth, subscribe);
router.delete('/subscriptions', verifyAuth, unsubscribe);

export default router;
