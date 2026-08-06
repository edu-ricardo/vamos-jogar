import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gameRoutes from './routes/games';
import groupRoutes from './routes/groups';
import cronRoutes from './routes/cron';

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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
