import { Router } from 'express';
import { getDb } from '../db.js';
import { randomUUID } from 'crypto';
import { getMealSuggestions, getRecipes, getShoppingList } from '../services/ai.js';
import { format, addDays, startOfWeek } from 'date-fns';

const router = Router();

// Load preferences helper
function loadPreferences() {
  const db = getDb();
  const p = db.prepare('SELECT * FROM preferences WHERE id = ?').get('default');
  if (p) {
    p.dietary_restrictions = JSON.parse(p.dietary_restrictions || '[]');
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

// Generate meal slots for the week
function getMealSlots(prefs) {
  const slots = [];
  const mealTypes = [
    { type: 'breakfast', count: prefs.breakfasts_per_week },
    { type: 'lunch', count: prefs.lunches_per_week },
    { type: 'dinner', count: prefs.dinners_per_week },
  ];
  for (const { type, count } of mealTypes) {
    for (let i = 0; i < count; i++) {
      slots.push({ mealType: type, dayIndex: i % 7 });
    }
  }
  return slots;
}

// POST /api/meals/suggest
router.post('/suggest', async (req, res) => {
  try {
    const { weekStart } = req.body;
    const prefs = loadPreferences();
    const start = weekStart ? new Date(weekStart) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekLabel = format(start, 'MMM d, yyyy');

    const slots = getMealSlots(prefs);
    const results = [];

    for (const slot of slots) {
      const count = 3; // 3 options per meal
      const suggestions = await getMealSuggestions(prefs, slot.mealType, count, weekLabel);
      results.push({
        mealType: slot.mealType,
        dayIndex: slot.dayIndex,
        day: format(addDays(start, slot.dayIndex), 'EEEE'),
        options: suggestions,
      });
    }

    const planId = randomUUID();
    const db = getDb();
    db.prepare(`
      INSERT INTO meal_plans (id, preferences_id, week_start, meals)
      VALUES (?, 'default', ?, ?)
    `).run(planId, format(start, 'yyyy-MM-dd'), JSON.stringify(results));

    res.json({ planId, suggestions: results, weekStart: format(start, 'yyyy-MM-dd') });
  } catch (err) {
    console.error('Meal suggest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meals/select
router.post('/select', async (req, res) => {
  try {
    const { planId, selections } = req.body; // selections: [{ mealType, dayIndex, meal }]
    if (!planId || !Array.isArray(selections)) {
      return res.status(400).json({ error: 'planId and selections required' });
    }

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
