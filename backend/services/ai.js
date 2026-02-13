import OpenAI from 'openai';
import { getDb } from '../db.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const DEFAULT_PREFERENCES = {
  breakfasts_per_week: 7,
  lunches_per_week: 7,
  dinners_per_week: 7,
  people_per_meal: 1,
  dietary_restrictions: [],
  protein_per_serving: 25,
  carbs_per_serving: 40,
  fat_per_serving: 15,
};

function buildPrompt(type, preferences, context = {}) {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const dietary = Array.isArray(prefs.dietary_restrictions) ? prefs.dietary_restrictions.join(', ') : (prefs.dietary_restrictions || '');
  const macros = `Protein: ${prefs.protein_per_serving}g, Carbs: ${prefs.carbs_per_serving}g, Fat: ${prefs.fat_per_serving}g per serving.`;
  const people = prefs.people_per_meal || 1;

  if (type === 'meal_suggestions') {
    const { mealType, count, weekStart } = context;
    const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    return `You are a nutritionist and meal planning expert. Generate exactly ${count} distinct ${mealLabel.toLowerCase()} meal options for a weekly meal plan starting ${weekStart}.

CONSTRAINTS:
- Dietary restrictions: ${dietary || 'None'}
- Target macronutrients per serving: ${macros}
- Servings per meal: ${people}

For each meal, respond with a JSON array of objects, each with: name (string), description (1 sentence), estimatedPrepMinutes (number), tags (array of strings like "quick", "vegetarian", "high-protein").
Return ONLY valid JSON, no markdown or extra text.`;
  }

  if (type === 'recipes') {
    const { meals } = context;
    return `You are a chef. For each of these meals, provide a detailed recipe in JSON format.

Meals: ${meals.map((m) => m.name).join(', ')}

Constraints: Dietary restrictions: ${dietary || 'None'}. Target macros per serving: ${macros}. Servings: ${people} per meal.

Return a JSON array of objects, one per meal, each with:
- name (string)
- ingredients (array of objects: { name, amount, unit } for ${people} servings)
- instructions (array of numbered steps as strings)
- prepMinutes (number)
- cookMinutes (number)
- macronutrients (object: protein, carbs, fat in grams per serving)

Return ONLY valid JSON, no markdown or extra text.`;
  }

  if (type === 'shopping_list') {
    const { recipes } = context;
    const ingredients = recipes.flatMap((r) => r.ingredients || []);
    return `Consolidate these ingredients into a single shopping list for ${people} people.

Ingredients (from multiple recipes): ${JSON.stringify(ingredients)}

Return a JSON array of objects: { name, totalAmount, unit, category } where category is one of: produce, dairy, meat, pantry, frozen, other.
Combine duplicate items (e.g. "2 cups flour" + "1 cup flour" = "3 cups flour").
Return ONLY valid JSON.`;
  }

  return '';
}

function mockMealSuggestions(mealType, count) {
  const bases = {
    breakfast: ['Oatmeal', 'Eggs Benedict', 'Smoothie Bowl', 'Avocado Toast', 'Greek Yogurt Parfait', 'Pancakes', 'Shakshuka'],
    lunch: ['Caesar Salad', 'Grilled Chicken Wrap', 'Buddha Bowl', 'Tom Yum Soup', 'Quinoa Salad', 'Tuna Poke Bowl', 'Falafel Plate'],
    dinner: ['Salmon Teriyaki', 'Beef Stir Fry', 'Pasta Primavera', 'Chicken Curry', 'Tacos', 'Risotto', 'Sheet Pan Chicken'],
  };
  const arr = bases[mealType] || bases.dinner;
  return Array.from({ length: count }, (_, i) => ({
    name: `${arr[i % arr.length]} #${i + 1}`,
    description: `Delicious ${mealType} option.`,
    estimatedPrepMinutes: 20 + (i % 15),
    tags: ['balanced'],
  }));
}

function mockRecipes(meals) {
  return meals.map((m) => ({
    name: m.name,
    ingredients: [
      { name: 'ingredient 1', amount: 1, unit: 'cup' },
      { name: 'ingredient 2', amount: 2, unit: 'tbsp' },
    ],
    instructions: ['Step 1: Prepare ingredients.', 'Step 2: Cook according to preference.'],
    prepMinutes: 15,
    cookMinutes: 25,
    macronutrients: { protein: 25, carbs: 40, fat: 15 },
  }));
}

function mockShoppingList(recipes) {
  const all = recipes.flatMap((r) => r.ingredients || []);
  const seen = new Map();
  for (const ing of all) {
    const key = ing.name?.toLowerCase() || 'unknown';
    if (!seen.has(key)) seen.set(key, { ...ing, category: 'pantry' });
  }
  return Array.from(seen.values()).map((i) => ({ name: i.name, totalAmount: i.amount, unit: i.unit, category: i.category }));
}

export async function getMealSuggestions(preferences, mealType, count, weekStart) {
  if (!openai.apiKey) {
    return mockMealSuggestions(mealType, count);
  }
  try {
    const prompt = buildPrompt('meal_suggestions', preferences, { mealType, count, weekStart });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('AI meal suggestions error:', err.message);
    return mockMealSuggestions(mealType, count);
  }
}

export async function getRecipes(preferences, meals) {
  if (!openai.apiKey) {
    return mockRecipes(meals);
  }
  try {
    const prompt = buildPrompt('recipes', preferences, { meals });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('AI recipes error:', err.message);
    return mockRecipes(meals);
  }
}

export async function getShoppingList(preferences, recipes) {
  if (!openai.apiKey) {
    return mockShoppingList(recipes);
  }
  try {
    const prompt = buildPrompt('shopping_list', preferences, { recipes });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('AI shopping list error:', err.message);
    return mockShoppingList(recipes);
  }
}
