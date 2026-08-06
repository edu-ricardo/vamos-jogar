"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const groupController_1 = require("../controllers/groupController");
const router = (0, express_1.Router)();
router.post('/join', authMiddleware_1.verifyAuth, groupController_1.joinGroup);
exports.default = router;
