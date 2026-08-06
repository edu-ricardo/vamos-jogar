"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cronController_1 = require("../controllers/cronController");
const router = (0, express_1.Router)();
// Endpoint chamado pelo Cron-job.org
router.get('/process-reminders', cronController_1.cronController.processReminders);
router.post('/process-reminders', cronController_1.cronController.processReminders);
// Endpoint chamado pelo botão do frontend
router.post('/force-event-reminders', cronController_1.cronController.forceRemindersForEvent);
exports.default = router;
