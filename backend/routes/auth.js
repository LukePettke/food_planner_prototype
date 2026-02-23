import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { requireAuth, optionalAuth, signToken, getSessionCookieOptions, COOKIE_NAME } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

// GET /api/auth/me - return current user if logged in
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  const db = getDb();
  const row = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
    },
  });
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim || !password || password.length < 8) {
      return res.status(400).json({
        error: 'Email and password required. Password must be at least 8 characters.',
      });
    }

    const db = getDb();
    const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(emailTrim);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, emailTrim, password_hash);

    // Create default preferences row for this user
    db.prepare(`
      INSERT INTO preferences (id, breakfasts_per_week, lunches_per_week, dinners_per_week, people_per_meal, dietary_restrictions, allergies, meal_complexity_levels, protein_per_serving, carbs_per_serving, fat_per_serving, recipe_units)
      VALUES (?, 7, 7, 7, 1, '[]', '[]', '["quick_easy","everyday","from_scratch"]', 25, 40, 15, 'imperial')
    `).run(id);

    const token = signToken(id);
    res.cookie(COOKIE_NAME, token, getSessionCookieOptions());
    res.status(201).json({
      user: { id, email: emailTrim, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const db = getDb();
    const row = db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?').get(emailTrim);
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(row.id);
    res.cookie(COOKIE_NAME, token, getSessionCookieOptions());
    res.json({
      user: { id: row.id, email: row.email, createdAt: row.created_at },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

export default router;
