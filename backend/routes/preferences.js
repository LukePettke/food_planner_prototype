import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function getPrefId(req) {
  return req.user?.id ?? 'default';
}

function parseMealComplexityLevels(raw) {
  if (raw == null || raw === '') return ['quick_easy', 'everyday', 'from_scratch'];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return ['quick_easy', 'everyday', 'from_scratch'];
    const filtered = arr.filter((id) => VALID_COMPLEXITY_LEVELS.includes(id));
    return filtered.length ? filtered : ['everyday'];
  } catch (_) {
    return ['quick_easy', 'everyday', 'from_scratch'];
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const prefId = getPrefId(req);
    const pref = db.prepare('SELECT * FROM preferences WHERE id = ?').get(prefId);
    if (pref) {
      pref.dietary_restrictions = JSON.parse(pref.dietary_restrictions || '[]');
      pref.allergies = JSON.parse(pref.allergies || '[]');
      pref.meal_complexity_levels = parseMealComplexityLevels(pref.meal_complexity_levels);
      res.json(pref);
    } else {
      res.json({
        id: prefId,
        breakfasts_per_week: 7,
        lunches_per_week: 7,
        dinners_per_week: 7,
        people_per_meal: 1,
        dietary_restrictions: [],
        allergies: [],
        meal_complexity_levels: ['quick_easy', 'everyday', 'from_scratch'],
        protein_per_serving: 25,
        carbs_per_serving: 40,
        fat_per_serving: 15,
        recipe_units: 'imperial',
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

const VALID_RECIPE_UNITS = ['imperial', 'metric'];
function normalizeRecipeUnits(val) {
  const v = (val || 'imperial').toLowerCase();
  return VALID_RECIPE_UNITS.includes(v) ? v : 'imperial';
}

const VALID_COMPLEXITY_LEVELS = ['quick_easy', 'everyday', 'from_scratch'];
function normalizeMealComplexityLevels(arr) {
  if (!Array.isArray(arr)) return ['quick_easy', 'everyday', 'from_scratch'];
  const filtered = arr.filter((id) => VALID_COMPLEXITY_LEVELS.includes(id));
  return filtered.length ? filtered : ['everyday'];
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
      allergies = [],
      meal_complexity_levels,
      protein_per_serving = 25,
      carbs_per_serving = 40,
      fat_per_serving = 15,
      recipe_units = 'imperial',
    } = req.body;

    const b = clampMeals(breakfasts_per_week);
    const l = clampMeals(lunches_per_week);
    const d = clampMeals(dinners_per_week);
    const units = normalizeRecipeUnits(recipe_units);
    const complexity = normalizeMealComplexityLevels(meal_complexity_levels);

    db.prepare(`
      INSERT INTO preferences (id, breakfasts_per_week, lunches_per_week, dinners_per_week, people_per_meal, dietary_restrictions, allergies, meal_complexity_levels, protein_per_serving, carbs_per_serving, fat_per_serving, recipe_units, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        breakfasts_per_week = excluded.breakfasts_per_week,
        lunches_per_week = excluded.lunches_per_week,
        dinners_per_week = excluded.dinners_per_week,
        people_per_meal = excluded.people_per_meal,
        dietary_restrictions = excluded.dietary_restrictions,
        allergies = excluded.allergies,
        meal_complexity_levels = excluded.meal_complexity_levels,
        protein_per_serving = excluded.protein_per_serving,
        carbs_per_serving = excluded.carbs_per_serving,
        fat_per_serving = excluded.fat_per_serving,
        recipe_units = excluded.recipe_units,
        updated_at = datetime('now')
    `).run(getPrefId(req), b, l, d, people_per_meal, JSON.stringify(dietary_restrictions), JSON.stringify(Array.isArray(allergies) ? allergies : []), JSON.stringify(complexity), protein_per_serving, carbs_per_serving, fat_per_serving, units);

    const saved = db.prepare('SELECT * FROM preferences WHERE id = ?').get(getPrefId(req));
    const out = saved ? {
      id: saved.id,
      breakfasts_per_week: Number(saved.breakfasts_per_week),
      lunches_per_week: Number(saved.lunches_per_week),
      dinners_per_week: Number(saved.dinners_per_week),
      people_per_meal: Number(saved.people_per_meal),
      dietary_restrictions: JSON.parse(saved.dietary_restrictions || '[]'),
      allergies: JSON.parse(saved.allergies || '[]'),
      meal_complexity_levels: parseMealComplexityLevels(saved.meal_complexity_levels),
      protein_per_serving: Number(saved.protein_per_serving),
      carbs_per_serving: Number(saved.carbs_per_serving),
      fat_per_serving: Number(saved.fat_per_serving),
      recipe_units: saved.recipe_units === 'metric' ? 'metric' : 'imperial',
    } : null;
    res.json(out ? { ok: true, preferences: out } : { ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
