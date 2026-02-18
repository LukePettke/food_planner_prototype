import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createDb, initDb } from './db.js';
import preferencesRoutes from './routes/preferences.js';
import mealsRoutes from './routes/meals.js';
import calendarRoutes from './routes/calendar.js';
import groceryRoutes from './routes/grocery.js';
import debugRoutes from './routes/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV === 'production') return cb(null, true);
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Initialize database (use env for path in production so volume can be mounted)
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'mealplanner.db');
initDb(dbPath);

// API routes
app.use('/api/preferences', preferencesRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/debug', debugRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Production: serve frontend build from backend/public (single deploy)
if (process.env.NODE_ENV === 'production') {
  const publicDir = join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(publicDir, 'index.html'), (err) => err && next(err));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  const pexels = !!process.env.PEXELS_API_KEY?.trim();
  if (!pexels) {
    console.log('Image APIs: Add PEXELS_API_KEY to .env for meal photos.');
  }
});
