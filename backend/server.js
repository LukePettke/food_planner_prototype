import './env.js'; // load .env first so OPENAI_API_KEY is set before ai.js is loaded
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { createDb, initDb } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import preferencesRoutes from './routes/preferences.js';
import mealsRoutes from './routes/meals.js';
import calendarRoutes from './routes/calendar.js';
import groceryRoutes from './routes/grocery.js';
import debugRoutes from './routes/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Railway injects PORT; must listen on this port (parsed as int). Do not set PORT in Railway Variables.
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV === 'production') return cb(null, true);
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Log every request (method + path + status) so devs see activity in the terminal
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Initialize database (use env for path in production so volume can be mounted)
const dataDir = join(__dirname, 'data');
let dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
  const legacyPath = join(dataDir, 'mealplanner.db');
  const newPath = join(dataDir, 'mealflow.db');
  dbPath = existsSync(legacyPath) ? legacyPath : newPath;
}
initDb(dbPath);

// API routes (auth is public; others require login)
app.use('/api/auth', authRoutes);
app.use('/api/preferences', requireAuth, preferencesRoutes);
app.use('/api/meals', requireAuth, mealsRoutes);
app.use('/api/calendar', requireAuth, calendarRoutes);
app.use('/api/grocery', requireAuth, groceryRoutes);
app.use('/api/debug', debugRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Fallback for GET / so health checks and visitors always get a response (e.g. Railway)
app.get('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const publicDir = join(__dirname, 'public');
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) return next();
  res.redirect(302, '/api/health');
});

// Production: serve frontend build from backend/public (single deploy)
if (process.env.NODE_ENV === 'production') {
  const publicDir = join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(publicDir, 'index.html'), (err) => err && next(err));
  });
}

const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'undefined'}, PORT from env: ${process.env.PORT ?? 'not set'})`);
  const publicDir = join(__dirname, 'public');
  console.log(`public dir exists: ${existsSync(publicDir)}, index.html: ${existsSync(join(publicDir, 'index.html'))}`);
  const pexels = !!process.env.PEXELS_API_KEY?.trim();
  if (!pexels) {
    console.log('Image APIs: Add PEXELS_API_KEY to .env for meal photos.');
  }
});
server.on('error', (err) => {
  console.error('Server listen error:', err);
  process.exit(1);
});
