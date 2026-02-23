import { Router } from 'express';
import { google } from 'googleapis';
import { getDb } from '../db.js';
import { format, addDays } from 'date-fns';

const router = Router();
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/calendar-callback';

// GET /api/calendar/auth-url
router.get('/auth-url', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = req.query.redirectUri || REDIRECT_URI;
  if (!clientId) {
    return res.json({
      configured: false,
      message: 'Google Calendar not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env',
    });
  }
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPES.join(' '))}&access_type=offline&prompt=consent`;
  res.json({ configured: true, authUrl });
});

// POST /api/calendar/token - exchange code for tokens
router.post('/token', async (req, res) => {
  const { code, redirectUri } = req.body;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !code) {
    return res.status(400).json({ error: 'Missing config or code' });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri || REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken(code);
    const db = getDb();
    const userId = req.user.id;
    db.prepare(`
      INSERT INTO google_tokens (id, access_token, refresh_token, expiry_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = COALESCE(excluded.refresh_token, refresh_token), expiry_date = excluded.expiry_date
    `).run(userId, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null);
    res.json({ ok: true });
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/events - add meal plan events
router.post('/events', async (req, res) => {
  const userId = req.user?.id;
  const { planId, weekStart } = req.body;
  const db = getDb();
  const tokens = db.prepare('SELECT * FROM google_tokens WHERE id = ?').get(userId);
  if (!tokens || !tokens.access_token) {
    return res.status(401).json({ error: 'Google Calendar not connected. Authorize first.' });
  }

  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(planId);
  if (!plan || plan.preferences_id !== userId) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  const selected = db.prepare('SELECT * FROM selected_meals WHERE plan_id = ?').all(planId);
  if (selected.length === 0) {
    return res.status(400).json({ error: 'No selected meals for this plan' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google not configured' });

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const start = weekStart ? new Date(weekStart) : new Date(plan.week_start);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const mealTimes = { breakfast: '08:00', lunch: '12:00', dinner: '18:00' };
  const created = [];

  for (const m of selected) {
    const day = addDays(start, m.day);
    const time = mealTimes[m.meal_type] || '12:00';
    const startDatetime = `${format(day, 'yyyy-MM-dd')}T${time}:00:00`;
    const endDatetime = `${format(day, 'yyyy-MM-dd')}T${parseInt(time, 10) + 1}:00:00`;
    try {
      const ev = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `${m.meal_name} (${m.meal_type})`,
          description: `Meal plan: ${m.meal_name}`,
          start: { dateTime: startDatetime, timeZone: 'America/New_York' },
          end: { dateTime: endDatetime, timeZone: 'America/New_York' },
        },
      });
      created.push(ev.data);
    } catch (err) {
      console.error('Calendar insert error:', err);
    }
  }

  res.json({ created: created.length, events: created });
});

export default router;
