import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import {
  getPreferences,
  getPublicKey,
  setPreferences,
  subscribe,
  unsubscribe,
} from '../controllers/pushController';

const router = Router();

router.get('/public-key', getPublicKey);
router.post('/subscriptions', verifyAuth, subscribe);
router.delete('/subscriptions', verifyAuth, unsubscribe);
router.get('/preferences', verifyAuth, getPreferences);
router.put('/preferences', verifyAuth, setPreferences);

export default router;
