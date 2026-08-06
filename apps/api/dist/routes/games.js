"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const gameController_1 = require("../controllers/gameController");
const router = (0, express_1.Router)();
router.get('/search', authMiddleware_1.verifyAuth, gameController_1.searchGames);
router.get('/details/:id', authMiddleware_1.verifyAuth, gameController_1.getGameDetails);
exports.default = router;
