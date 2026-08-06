import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { searchGames, getGameDetails } from '../controllers/gameController';

const router = Router();

router.get('/search', verifyAuth, searchGames);
router.get('/details/:id', verifyAuth, getGameDetails);

export default router;
