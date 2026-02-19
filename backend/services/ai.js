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
    return `You are a nutritionist and meal planning expert. Generate exactly ${count} UNIQUE ${mealLabel.toLowerCase()} meal options for the week of ${weekStart}.

CRITICAL RULES:
- Every option must be completely different - NO duplicate or near-duplicate meal names (e.g. do not include both "Scrambled Eggs" and "Scrambled Eggs with Toast")
- Vary the cuisines, cooking styles, and ingredients across all ${count} options
- Tailor options to feel fresh for this specific week - vary suggestions based on season/context

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

function mockMealSuggestions(mealType, count, weekStart = '') {
  const pools = {
    breakfast: [
      'Oatmeal with Berries', 'Eggs Benedict', 'Smoothie Bowl', 'Avocado Toast', 'Greek Yogurt Parfait',
      'Pancakes with Maple Syrup', 'Shakshuka', 'Breakfast Burrito', 'French Toast', 'Chia Pudding',
      'Acai Bowl', 'Egg Muffins', 'Overnight Oats', 'Breakfast Quesadilla', 'Granola with Fruit',
    ],
    lunch: [
      'Caesar Salad', 'Grilled Chicken Wrap', 'Buddha Bowl', 'Tom Yum Soup', 'Quinoa Salad',
      'Tuna Poke Bowl', 'Falafel Plate', 'Cobb Salad', 'Turkey Club', 'Miso Soup with Rice',
      'Caprese Sandwich', 'Lentil Soup', 'Mediterranean Bowl', 'Pho', 'Sushi Roll Combo',
    ],
    dinner: [
      'Salmon Teriyaki', 'Beef Stir Fry', 'Pasta Primavera', 'Chicken Curry', 'Fish Tacos',
      'Risotto', 'Sheet Pan Chicken', 'Grilled Steak', 'Pad Thai', 'Vegetable Stir Fry',
      'Lamb Chops', 'Mushroom Risotto', 'Shrimp Scampi', 'Biryani', 'Stuffed Peppers',
    ],
  };
  const arr = pools[mealType] || pools.dinner;
  const seed = weekStart ? weekStart.split('').reduce((s, c) => s + c.charCodeAt(0), 0) : Date.now();
  const shuffled = [...arr].sort((a, b) => {
    const ha = (seed + a.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 1000;
    const hb = (seed + b.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 1000;
    return ha - hb;
  });
  return shuffled.slice(0, count).map((n) => ({
    name: n,
    description: `Delicious ${mealType} option.`,
    estimatedPrepMinutes: 20 + (n.length % 15),
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

function deduplicateOptions(options) {
  const seen = new Set();
  return options.filter((opt) => {
    const key = (opt?.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getMealSuggestions(preferences, mealType, count, weekStart) {
  if (!openai.apiKey) {
    return mockMealSuggestions(mealType, count, weekStart);
  }
  try {
    const prompt = buildPrompt('meal_suggestions', preferences, { mealType, count, weekStart });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    let options = JSON.parse(cleaned);
    if (!Array.isArray(options)) options = [];
    const unique = deduplicateOptions(options);
    return unique.slice(0, count);
  } catch (err) {
    console.error('AI meal suggestions error:', err.message);
    return mockMealSuggestions(mealType, count, weekStart);
  }
}

export async function getImageSearchQueries(mealOptions, mealType) {
  // Without OpenAI, use meal name only so Pexels gets a clear dish-specific query (no noisy description)
  if (!openai.apiKey || !Array.isArray(mealOptions) || mealOptions.length === 0) {
    return (mealOptions || []).map((n) => {
      const name = n && typeof n === 'object' ? n.name : n;
      return (name || '').trim() || 'food dish';
    });
  }
  try {
    const list = mealOptions.map((o) => {
      const name = o?.name || o || '';
      const desc = o?.description || '';
      return desc ? `${name}\n  Description: ${desc}` : name;
    }).join('\n\n');
    const prompt = `Generate one image-search phrase per meal for a food photo API. Each phrase must be UNIQUE and describe ONLY that specific dish so we get a different, matching photo for each.

Rules:
- Use the exact dish name plus 1-2 key ingredients (e.g. "shakshuka eggs tomato", "grilled chicken wrap", "acai bowl berries").
- Every phrase must be different from the others—no repeated words across phrases.
- Phrase = 2-5 words, food-only (no people). We will append " food" for the API.

Meal type: ${mealType}
Meals (name and description):
${list}

Output a JSON array of strings, one phrase per meal in the same order. Example: ["pancakes maple syrup", "overnight oats berries", "breakfast burrito eggs", "granola fruit yogurt", "acai bowl toppings", "greek yogurt parfait", "oatmeal berries", "shakshuka eggs tomato", "breakfast quesadilla cheese", "egg muffins"]. Return ONLY the JSON array, no markdown.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    const queries = JSON.parse(cleaned);
    return Array.isArray(queries) ? queries : mealOptions.map((o) => `${o?.name || o} ${o?.description || ''}`.trim() || 'food');
  } catch (err) {
    console.error('AI image search query error:', err.message);
    return mealOptions.map((o) => `${o?.name || o} ${o?.description || ''}`.trim() || 'food dish');
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

/** Verify OpenAI API key is set and valid. Returns { ok, error?, keySet? }. */
export async function verifyOpenAIKey() {
  const keySet = !!(process.env.OPENAI_API_KEY || '').trim();
  if (!keySet) {
    return { ok: false, keySet: false, error: 'OPENAI_API_KEY not set in .env' };
  }
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 5,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    return { ok: true, keySet: true, response: text };
  } catch (err) {
    const msg = err?.message || String(err);
    const isAuth = msg.includes('401') || msg.includes('Incorrect API key') || msg.includes('invalid_api_key');
    return {
      ok: false,
      keySet: true,
      error: isAuth ? 'Invalid or expired API key' : msg,
    };
  }
}
