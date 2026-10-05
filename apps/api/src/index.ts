import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gameRoutes from './routes/games';
import groupRoutes from './routes/groups';
import cronRoutes from './routes/cron';
import accountRoutes from './routes/account';
import pushRoutes from './routes/push';
import { readVapidConfig, reminderService } from './services/notifications';
import { startReminderScheduler } from './services/reminderScheduler';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Registrar rotas
app.use('/api/games', gameRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/push', pushRoutes);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Avisa já ao iniciar se as notificações não vão funcionar, em vez de só na hora do envio
const vapid = readVapidConfig(process.env);
if ('missing' in vapid) {
  console.warn(`Notificações desativadas: falta ${vapid.missing.join(', ')} no ambiente`);
}

startReminderScheduler(reminderService.processScheduledReminders);
