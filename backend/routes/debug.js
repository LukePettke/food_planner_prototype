import { Router } from 'express';
import { getDb } from '../db.js';
import { verifyOpenAIKey } from '../services/ai.js';

const router = Router();

// GET /api/debug/openai - verify OpenAI API key is set and valid
router.get('/openai', async (req, res) => {
  try {
    const result = await verifyOpenAIKey();
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// POST /api/debug/clear-meals - delete all meal plans, selected meals, and grocery lists
router.post('/clear-meals', (req, res) => {
  try {
    const db = getDb();
    db.exec(`
      DELETE FROM grocery_lists;
      DELETE FROM selected_meals;
      DELETE FROM meal_plans;
    `);
    res.json({ ok: true, message: 'All meals, plans, and grocery lists deleted.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/debug/pexels - test Pexels API (for troubleshooting)
router.get('/pexels', async (req, res) => {
  const key = process.env.PEXELS_API_KEY || '';
  const hasKey = !!key.trim();
  if (!hasKey) {
    return res.json({ ok: false, error: 'PEXELS_API_KEY not set in .env' });
  }
  try {
    const res2 = await fetch(
      'https://api.pexels.com/v1/search?query=pancakes+food&per_page=1',
      { headers: { Authorization: key.trim() } }
    );
    const data = await res2.json();
    const img = data?.photos?.[0];
    const url = img?.src?.small || img?.src?.medium || null;
    if (res2.status !== 200) {
      return res.json({
        ok: false,
        status: res2.status,
        error: data?.error || data?.message || 'Pexels API error',
        raw: data,
      });
    }
    res.json({
      ok: true,
      hasResults: !!img,
      sampleUrl: url,
      status: res2.status,
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

export default router;
