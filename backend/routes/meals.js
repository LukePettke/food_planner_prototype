import { Router } from 'express';
import { getDb } from '../db.js';
import { randomUUID } from 'crypto';
import { getMealSuggestions, getRecipes, getShoppingList } from '../services/ai.js';
import { addImagesToOptions } from '../services/images.js';
import { format, addDays, startOfWeek } from 'date-fns';

const router = Router();

// Load preferences helper - explicitly coerce meal counts so DB string/int doesn't break math
function loadPreferences() {
  const db = getDb();
  const p = db.prepare('SELECT * FROM preferences WHERE id = ?').get('default');
  if (p) {
    p.dietary_restrictions = JSON.parse(p.dietary_restrictions || '[]');
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
    protein_per_serving: 25,
    carbs_per_serving: 40,
    fat_per_serving: 15,
  };
}

const OPTIONS_PER_SLOT = 2;
const MAX_MEALS_PER_WEEK = 7;

function clampMealsPerWeek(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v < 0) return 0;
  return Math.min(MAX_MEALS_PER_WEEK, Math.floor(v));
}

// POST /api/meals/suggest - 2 options per meals-per-week (e.g. 5 breakfasts → 10 options)
router.post('/suggest', async (req, res) => {
  try {
    const { weekStart } = req.body;
    const prefs = loadPreferences();
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
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[meals/suggest] ${mealType}: mealsPerWeek=${slots} → requesting ${count} options`);
      }
      const suggestions = count > 0
        ? await getMealSuggestions(prefs, mealType, count, weekLabel)
        : [];
      const optionsWithImages = await addImagesToOptions(suggestions, mealType);
      results[`${mealType}Options`] = optionsWithImages;
    }

    const planId = randomUUID();
    const db = getDb();
    db.prepare(`
      INSERT INTO meal_plans (id, preferences_id, week_start, meals)
      VALUES (?, 'default', ?, ?)
    `).run(planId, format(start, 'yyyy-MM-dd'), JSON.stringify(results));

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

    const prefs = loadPreferences();
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const mealsToFetch = selections.map((s) => ({ name: s.meal.name, description: s.meal.description }));
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
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

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

// GET /api/meals/plan/:planId
router.get('/plan/:planId', (req, res) => {
  try {
    const db = getDb();
    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
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
