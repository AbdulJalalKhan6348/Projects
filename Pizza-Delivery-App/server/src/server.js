import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import orderRoutes from './routes/orders.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { seedAdmin, seedInventory } from './utils/seed.js';
import { startLowStockJob } from './jobs/lowStock.job.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'pizza-delivery-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error.status) || 500;
  res.status(status).json({ message: status >= 500 ? 'Server error. Please try again.' : error.message });
});

const port = Number(process.env.PORT || 5000);

try {
  await connectDB();
  await seedInventory();
  await seedAdmin();
  startLowStockJob();
  app.listen(port, () => console.log(`Pizza API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Server startup failed:', error);
  process.exit(1);
}
