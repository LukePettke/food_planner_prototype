import { Router } from 'express';
import { getDb } from '../db.js';
import { randomUUID } from 'crypto';
import { getMealSuggestions, getRecipes, getShoppingList } from '../services/ai.js';
import { addImagesToOptions } from '../services/images.js';
import { format, addDays, startOfWeek, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

const router = Router();

// Load preferences helper - explicitly coerce meal counts so DB string/int doesn't break math
function loadPreferences(userId) {
  const db = getDb();
  const prefId = userId || 'default';
  const p = db.prepare('SELECT * FROM preferences WHERE id = ?').get(prefId);
  if (p) {
    p.dietary_restrictions = JSON.parse(p.dietary_restrictions || '[]');
    p.meal_complexity_levels = JSON.parse(p.meal_complexity_levels || '["quick_easy","everyday","from_scratch"]');
    p.breakfasts_per_week = Number(p.breakfasts_per_week);
    p.lunches_per_week = Number(p.lunches_per_week);
    p.dinners_per_week = Number(p.dinners_per_week);
    if (Number.isNaN(p.breakfasts_per_week)) p.breakfasts_per_week = 7;
    if (Number.isNaN(p.lunches_per_week)) p.lunches_per_week = 7;
    if (Number.isNaN(p.dinners_per_week)) p.dinners_per_week = 7;
    return p;
  }
  return {
    breakfasts_per_week: 7,
    lunches_per_week: 7,
    dinners_per_week: 7,
    people_per_meal: 1,
    dietary_restrictions: [],
    meal_complexity_levels: ['quick_easy', 'everyday', 'from_scratch'],
    protein_per_serving: 25,
    carbs_per_serving: 40,
    fat_per_serving: 15,
    recipe_units: 'imperial',
  };
}

/** Split total count equally across selected complexity levels. Returns e.g. { quick_easy: 2, everyday: 2, from_scratch: 2 }. */
function splitCountByLevel(total, levels) {
  if (!Array.isArray(levels) || levels.length === 0 || total <= 0) return { everyday: total };
  const perLevel = Math.floor(total / levels.length);
  const remainder = total % levels.length;
  const out = {};
  levels.forEach((level, i) => {
    out[level] = perLevel + (i < remainder ? 1 : 0);
  });
  return out;
}

const OPTIONS_PER_SLOT = 2;
const MAX_MEALS_PER_WEEK = 7;

function clampMealsPerWeek(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v < 0) return 0;
  return Math.min(MAX_MEALS_PER_WEEK, Math.floor(v));
}

// ----- Meal library: reuse saved ideas, save new AI ones -----
// When allowedLevels is set, only return library meals that match the user's selected complexity (e.g. only quick_easy when they chose "simplest").
function getMealsFromLibrary(mealType, limit, allowedLevels = null) {
  const db = getDb();
  const validLevels = ['quick_easy', 'everyday', 'from_scratch'];
  let rows;
  if (Array.isArray(allowedLevels) && allowedLevels.length > 0) {
    const placeholders = allowedLevels.filter((l) => validLevels.includes(l));
    if (placeholders.length === 0) {
      rows = [];
    } else {
      const ph = placeholders.map(() => '?').join(',');
      rows = db.prepare(
        `SELECT id, meal_type, name, description, tags, complexity_level, created_at FROM meal_library WHERE meal_type = ? AND complexity_level IN (${ph}) ORDER BY RANDOM() LIMIT ?`
      ).all(mealType, ...placeholders, limit);
    }
  } else {
    rows = db.prepare(
      `SELECT id, meal_type, name, description, tags, complexity_level, created_at FROM meal_library WHERE meal_type = ? ORDER BY RANDOM() LIMIT ?`
    ).all(mealType, limit);
  }
  return rows.map((r) => ({
    name: r.name,
    description: r.description || '',
    tags: JSON.parse(r.tags || '[]'),
    estimatedPrepMinutes: 25,
    complexity: validLevels.includes(r.complexity_level) ? r.complexity_level : 'everyday',
  }));
}

function isMealInLibrary(mealType, name) {
  const db = getDb();
  const n = (name || '').trim().toLowerCase();
  if (!n) return true;
  const row = db.prepare(
    `SELECT 1 FROM meal_library WHERE meal_type = ? AND lower(trim(name)) = ? LIMIT 1`
  ).get(mealType, n);
  return !!row;
}

function saveMealsToLibrary(mealType, meals) {
  if (!Array.isArray(meals) || meals.length === 0) return;
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO meal_library (id, meal_type, name, description, tags, complexity_level, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const validLevels = ['quick_easy', 'everyday', 'from_scratch'];
  for (const m of meals) {
    const name = (m?.name || '').trim();
    if (!name || isMealInLibrary(mealType, name)) continue;
    const complexity = validLevels.includes(m?.complexity) ? m.complexity : null;
    insert.run(randomUUID(), mealType, name, (m?.description || '').trim() || null, JSON.stringify(m?.tags || []), complexity);
  }
}

// POST /api/meals/suggest - use library first, top up with AI; save new AI ideas to library
router.post('/suggest', async (req, res) => {
  try {
    const { weekStart } = req.body;
    const userId = req.user?.id;
    const prefs = loadPreferences(userId);
    const start = weekStart ? new Date(weekStart) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekLabel = format(start, 'MMM d, yyyy');
    const dayLabels = [0, 1, 2, 3, 4, 5, 6].map((d) => format(addDays(start, d), 'EEE'));

    const mealsPerWeek = {
      breakfast: clampMealsPerWeek(prefs.breakfasts_per_week),
      lunch: clampMealsPerWeek(prefs.lunches_per_week),
      dinner: clampMealsPerWeek(prefs.dinners_per_week),
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const results = { dayLabels, weekStart: format(start, 'yyyy-MM-dd'), mealsPerWeek };

    for (const mealType of mealTypes) {
      const slots = mealsPerWeek[mealType];
      const count = slots * OPTIONS_PER_SLOT;
      if (count <= 0) {
        results[`${mealType}Options`] = [];
        continue;
      }

      const allowedLevels = Array.isArray(prefs.meal_complexity_levels) && prefs.meal_complexity_levels.length > 0
        ? prefs.meal_complexity_levels
        : null;
      const fromLibrary = getMealsFromLibrary(mealType, count, allowedLevels);
      const needFromAi = Math.max(0, count - fromLibrary.length);
      let fromAi = [];
      if (needFromAi > 0) {
        const levels = Array.isArray(prefs.meal_complexity_levels) && prefs.meal_complexity_levels.length > 0
          ? prefs.meal_complexity_levels
          : ['quick_easy', 'everyday', 'from_scratch'];
        const countPerLevel = splitCountByLevel(needFromAi, levels);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[meals/suggest] ${mealType}: ${fromLibrary.length} from library, ${needFromAi} from AI`, countPerLevel);
        }
        fromAi = await getMealSuggestions(prefs, mealType, countPerLevel, weekLabel);
        saveMealsToLibrary(mealType, fromAi);
      }

      const seen = new Set();
      const combined = [];
      for (const m of [...fromLibrary, ...fromAi]) {
        const key = (m?.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push(m);
        if (combined.length >= count) break;
      }
      const optionsWithImages = await addImagesToOptions(combined, mealType);
      results[`${mealType}Options`] = optionsWithImages;
    }

    const planId = randomUUID();
    const db = getDb();
    db.prepare(`
      INSERT INTO meal_plans (id, preferences_id, week_start, meals)
      VALUES (?, ?, ?, ?)
    `).run(planId, userId || 'default', format(start, 'yyyy-MM-dd'), JSON.stringify(results));

    const optionCounts = {
      breakfast: (results.breakfastOptions || []).length,
      lunch: (results.lunchOptions || []).length,
      dinner: (results.dinnerOptions || []).length,
    };
    res.json({
      planId,
      suggestions: results,
      weekStart: format(start, 'yyyy-MM-dd'),
      optionCounts,
      mealsPerWeek,
    });
  } catch (err) {
    console.error('Meal suggest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meals/select
router.post('/select', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { planId, selections: rawSelections } = req.body;
    // Accept either: selections: [{ mealType, dayIndex, meal }] OR assignments: { breakfast: { 0: meal }, ... }
    let selections;
    if (Array.isArray(rawSelections)) {
      selections = rawSelections;
    } else if (rawSelections && typeof rawSelections === 'object' && rawSelections.assignments) {
      const a = rawSelections.assignments;
      selections = [];
      for (const mealType of ['breakfast', 'lunch', 'dinner']) {
        const days = a[mealType] || {};
        const indices = Object.keys(days).map(Number).filter((n) => !Number.isNaN(n)).sort((x, y) => x - y);
        for (const dayIndex of indices) {
          const meal = days[dayIndex];
          if (meal) selections.push({ mealType, dayIndex, meal });
        }
      }
    } else {
      return res.status(400).json({ error: 'planId and selections or assignments required' });
    }
    if (!planId) return res.status(400).json({ error: 'planId required' });

    const prefs = loadPreferences(userId);
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.preferences_id !== userId) return res.status(403).json({ error: 'Plan not found' });

    const mealsToFetch = selections.map((s) => ({
      name: s.meal.name,
      description: s.meal.description,
      complexity: s.meal.complexity || 'everyday',
    }));
    const recipes = await getRecipes(prefs, mealsToFetch);
    const shoppingList = await getShoppingList(prefs, recipes);

    const groceryId = randomUUID();
    db.prepare('INSERT INTO grocery_lists (id, plan_id, items) VALUES (?, ?, ?)')
      .run(groceryId, planId, JSON.stringify(shoppingList));

    for (let i = 0; i < selections.length; i++) {
      const s = selections[i];
      const recipe = recipes[i] || recipes[0];
      db.prepare(`
        INSERT INTO selected_meals (id, plan_id, meal_type, day, meal_name, recipe, ingredients, macronutrients)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        planId,
        s.mealType,
        s.dayIndex,
        s.meal.name,
        JSON.stringify(recipe),
        JSON.stringify(recipe.ingredients || []),
        JSON.stringify(recipe.macronutrients || {})
      );
    }

    res.json({
      planId,
      recipes: recipes.map((r, i) => ({ ...r, selection: selections[i] })),
      shoppingList,
      groceryId,
    });
  } catch (err) {
    console.error('Meal select error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meals/refresh-images/:planId - re-fetch photos for existing plan
router.post('/refresh-images/:planId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.preferences_id !== userId) return res.status(403).json({ error: 'Plan not found' });

    const meals = JSON.parse(plan.meals || '{}');
    if (!meals.breakfastOptions) return res.status(400).json({ error: 'Plan format not supported for image refresh' });

    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const opts = meals[`${mealType}Options`] || [];
      if (opts.length) {
        meals[`${mealType}Options`] = await addImagesToOptions(opts, mealType);
      }
    }

    db.prepare('UPDATE meal_plans SET meals = ? WHERE id = ?').run(JSON.stringify(meals), req.params.planId);
    plan.meals = meals;
    const selected = db.prepare('SELECT * FROM selected_meals WHERE plan_id = ?').all(req.params.planId);
    const grocery = db.prepare('SELECT * FROM grocery_lists WHERE plan_id = ?').get(req.params.planId);
    res.json({
      ok: true,
      plan,
      selectedMeals: selected.map((s) => ({
        ...s,
        recipe: JSON.parse(s.recipe || '{}'),
        ingredients: JSON.parse(s.ingredients || '[]'),
        macronutrients: JSON.parse(s.macronutrients || '{}'),
      })),
      groceryList: grocery ? JSON.parse(grocery.items || '[]') : [],
    });
  } catch (err) {
    console.error('Refresh images error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals/plans - list user's meal plans (optionally ?date=YYYY-MM-DD to find plan for that week)
router.get('/plans', (req, res) => {
  try {
    const userId = req.user?.id;
    const dateParam = req.query.date;
    const db = getDb();

    if (dateParam) {
      const d = parseISO(dateParam);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
      const day = startOfDay(d);
      const rows = db.prepare(
        'SELECT id, week_start FROM meal_plans WHERE preferences_id = ? ORDER BY week_start DESC'
      ).all(userId);
      const plan = rows.find((p) => {
        const weekStart = parseISO(p.week_start);
        const weekEnd = endOfDay(addDays(weekStart, 6));
        return isWithinInterval(day, { start: weekStart, end: weekEnd });
      });
      if (!plan) return res.status(404).json({ error: 'No meal plan found for that week' });
      const selectedCount = db.prepare('SELECT COUNT(*) as n FROM selected_meals WHERE plan_id = ?').get(plan.id);
      return res.json({
        plan: {
          id: plan.id,
          week_start: plan.week_start,
          week_label: formatWeekLabel(plan.week_start),
          has_selections: (selectedCount?.n ?? 0) > 0,
        },
      });
    }

    const rows = db.prepare(
      'SELECT id, week_start FROM meal_plans WHERE preferences_id = ? ORDER BY week_start DESC'
    ).all(userId);
    const plans = rows.map((p) => {
      const selectedCount = db.prepare('SELECT COUNT(*) as n FROM selected_meals WHERE plan_id = ?').get(p.id);
      return {
        id: p.id,
        week_start: p.week_start,
        week_label: formatWeekLabel(p.week_start),
        has_selections: (selectedCount?.n ?? 0) > 0,
      };
    });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatWeekLabel(weekStartStr) {
  const start = parseISO(weekStartStr);
  const end = addDays(start, 6);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

// DELETE /api/meals/plan/:planId
router.delete('/plan/:planId', (req, res) => {
  try {
    const userId = req.user?.id;
    const { planId } = req.params;
    const db = getDb();
    const plan = db.prepare('SELECT id, preferences_id FROM meal_plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.preferences_id !== userId) return res.status(403).json({ error: 'Plan not found' });
    db.prepare('DELETE FROM selected_meals WHERE plan_id = ?').run(planId);
    db.prepare('DELETE FROM grocery_lists WHERE plan_id = ?').run(planId);
    db.prepare('DELETE FROM meal_plans WHERE id = ?').run(planId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals/plan/:planId
router.get('/plan/:planId', (req, res) => {
  try {
    const userId = req.user?.id;
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.preferences_id !== userId) return res.status(403).json({ error: 'Plan not found' });
    plan.meals = JSON.parse(plan.meals || '[]');

    const selected = db.prepare('SELECT * FROM selected_meals WHERE plan_id = ?').all(req.params.planId);
    const grocery = db.prepare('SELECT * FROM grocery_lists WHERE plan_id = ?').get(req.params.planId);

    res.json({
      plan,
      selectedMeals: selected.map((s) => ({
        ...s,
        recipe: JSON.parse(s.recipe || '{}'),
        ingredients: JSON.parse(s.ingredients || '[]'),
        macronutrients: JSON.parse(s.macronutrients || '{}'),
      })),
      groceryList: grocery ? JSON.parse(grocery.items || '[]') : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
