import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();
const PREF_ID = 'default';

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const pref = db.prepare('SELECT * FROM preferences WHERE id = ?').get(PREF_ID);
    if (pref) {
      pref.dietary_restrictions = JSON.parse(pref.dietary_restrictions || '[]');
      res.json(pref);
    } else {
      res.json({
        id: PREF_ID,
        breakfasts_per_week: 7,
        lunches_per_week: 7,
        dinners_per_week: 7,
        people_per_meal: 1,
        dietary_restrictions: [],
        protein_per_serving: 25,
        carbs_per_serving: 40,
        fat_per_serving: 15,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const MAX_MEALS_PER_WEEK = 7;
function clampMeals(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v < 0) return 0;
  return Math.min(MAX_MEALS_PER_WEEK, Math.floor(v));
}

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      breakfasts_per_week = 7,
      lunches_per_week = 7,
      dinners_per_week = 7,
      people_per_meal = 1,
      dietary_restrictions = [],
      protein_per_serving = 25,
      carbs_per_serving = 40,
      fat_per_serving = 15,
    } = req.body;

    const b = clampMeals(breakfasts_per_week);
    const l = clampMeals(lunches_per_week);
    const d = clampMeals(dinners_per_week);

    db.prepare(`
      INSERT INTO preferences (id, breakfasts_per_week, lunches_per_week, dinners_per_week, people_per_meal, dietary_restrictions, protein_per_serving, carbs_per_serving, fat_per_serving, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        breakfasts_per_week = excluded.breakfasts_per_week,
        lunches_per_week = excluded.lunches_per_week,
        dinners_per_week = excluded.dinners_per_week,
        people_per_meal = excluded.people_per_meal,
        dietary_restrictions = excluded.dietary_restrictions,
        protein_per_serving = excluded.protein_per_serving,
        carbs_per_serving = excluded.carbs_per_serving,
        fat_per_serving = excluded.fat_per_serving,
        updated_at = datetime('now')
    `).run(PREF_ID, b, l, d, people_per_meal, JSON.stringify(dietary_restrictions), protein_per_serving, carbs_per_serving, fat_per_serving);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
