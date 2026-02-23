import OpenAI from 'openai';
import { getDb } from '../db.js';
import { getRecipeForMeal, hasApi as hasSpoonacular } from './spoonacular.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const DEFAULT_PREFERENCES = {
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
};

const COMPLEXITY_DESCRIPTIONS = {
  quick_easy: 'Quick & Easy: ONLY simple, familiar, everyday foods—e.g. Eggs and Bacon, Pancakes, Cereal, Ham and Cheese Sandwich, Grilled Cheese, Pizza, Burgers, Hot Dogs, Chicken Fingers, Steak, Mac and Cheese. No fancy names, no "bowls", no elaborate or exotic dishes.',
  everyday: 'Everyday: familiar dishes with moderate effort and cook time.',
  from_scratch: 'From-Scratch: MORE INVOLVED only—e.g. Coq au Vin, Beef Bourguignon, homemade pasta or gnocchi, risotto, braised short ribs, cassoulet, from-scratch stocks/sauces, layered lasagna, paella, mole, beef Wellington. Do NOT use: Mac and Cheese, burgers, basic tacos, grilled cheese, spaghetti and meatballs, simple stir-fry, or any quick/everyday dish.',
};

function buildPrompt(type, preferences, context = {}) {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const dietary = Array.isArray(prefs.dietary_restrictions) ? prefs.dietary_restrictions.join(', ') : (prefs.dietary_restrictions || '');
  const allergies = Array.isArray(prefs.allergies) ? prefs.allergies.join(', ') : (prefs.allergies || '');
  const macros = `Protein: ${prefs.protein_per_serving}g, Carbs: ${prefs.carbs_per_serving}g, Fat: ${prefs.fat_per_serving}g per serving.`;
  const people = prefs.people_per_meal || 1;

  if (type === 'meal_suggestions') {
    const { mealType, countPerLevel, weekStart } = context;
    const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const total = Object.values(countPerLevel || {}).reduce((a, b) => a + b, 0);
    const levelParts = countPerLevel && total > 0
      ? Object.entries(countPerLevel)
        .filter(([, n]) => n > 0)
        .map(([level, n]) => `${n} "${level.replace(/_/g, ' ')}" style (${COMPLEXITY_DESCRIPTIONS[level] || level})`)
        .join(', and ')
      : '';

    const levelInstruction = levelParts
      ? `RECIPE STYLE MIX (give exactly this many of each style): ${levelParts}. Total ${total} options. Each meal object MUST include "complexity" (string: one of quick_easy, everyday, from_scratch) matching its style.`
      : `Generate ${total} options. Each meal object MUST include "complexity" (string: one of quick_easy, everyday, from_scratch).`;

    return `You are a nutritionist and meal planning expert. Generate exactly ${total} UNIQUE ${mealLabel.toLowerCase()} meal options for the week of ${weekStart}.

CRITICAL RULES:
- Every option must be completely different - NO duplicate or near-duplicate meal names (e.g. do not include both "Scrambled Eggs" and "Scrambled Eggs with Toast")
- For "quick_easy" / Quick & Easy options ONLY: use simple, familiar dish names like Eggs and Bacon, Pancakes, Cereal, Oatmeal, Toast, Ham and Cheese Sandwich, Grilled Cheese, PB&J, Pizza, Burger, Hot Dog, Chicken Fingers, Steak, Mac and Cheese, Spaghetti, Tacos. Do NOT use elaborate names, "bowls", avocado toast, quinoa, or gourmet-style dishes for quick_easy.
- For "from_scratch" ONLY: use MORE INVOLVED, chef-style dishes—e.g. Coq au Vin, Beef Bourguignon, Risotto, homemade pasta or gnocchi, braised short ribs, cassoulet, paella, mole, beef Wellington, from-scratch stocks/sauces. Do NOT put simple dishes in from_scratch: no Mac and Cheese, no burgers, no basic tacos, no grilled cheese, no spaghetti and meatballs, no simple stir-fry.
- For "everyday" use familiar dishes with moderate effort (between quick_easy and from_scratch).
- Vary options across the ${total} meals; tailor to season/context where appropriate.
- ${levelInstruction}

CONSTRAINTS:
- Dietary restrictions: ${dietary || 'None'}
- Allergies (must avoid): ${allergies || 'None'}
- Target macronutrients per serving: ${macros}
- Servings per meal: ${people}

For each meal, respond with a JSON array of objects, each with: name (string), description (1 sentence), estimatedPrepMinutes (number), tags (array of strings), complexity (string: quick_easy, everyday, or from_scratch).
Return ONLY valid JSON, no markdown or extra text.`;
  }

  if (type === 'recipes') {
    const { meals } = context;
    const useMetric = (prefs.recipe_units || 'imperial') === 'metric';
    const unitInstruction = useMetric
      ? 'Use METRIC units only for all ingredients and temperatures: ml, g, kg, °C (e.g. 200 ml milk, 150 g flour, 180 °C oven).'
      : 'Use IMPERIAL/US customary units only for all ingredients and temperatures: cups, tbsp, tsp, oz, lb, °F (e.g. 1 cup flour, 2 tbsp oil, 350 °F oven).';
    const mealList = meals.map((m) => `${m.name} (complexity: ${m.complexity || 'everyday'})`).join(', ');
    return `You are a chef. For each of these meals, provide a recipe in JSON format. Match the COMPLEXITY level for each meal:
- quick_easy: Simple recipe, few ingredients (under 10), minimal steps (under 6), short prep/cook. No advanced techniques.
- everyday: Moderate ingredients and steps, familiar methods.
- from_scratch: More involved recipe—multiple steps, from-scratch sauces or stocks, chef-style techniques. Do NOT use simple dishes (e.g. not mac and cheese, burgers, basic tacos); use braised dishes, risotto, homemade pasta, complex sauces, etc.

Meals with their complexity: ${mealList}

Constraints: Dietary restrictions: ${dietary || 'None'}. Allergies (must avoid): ${allergies || 'None'}. Target macros per serving: ${macros}. Servings: ${people} per meal.

UNIT SYSTEM: ${unitInstruction}

Return a JSON array of objects, one per meal in the same order as the list above, each with:
- name (string)
- ingredients (array of objects: { name, amount, unit } for ${people} servings — use only the unit system specified above)
- instructions (array of numbered steps as strings)
- prepMinutes (number)
- cookMinutes (number)
- macronutrients (object: protein, carbs, fat in grams per serving)

Return ONLY valid JSON, no markdown or extra text.`;
  }

  if (type === 'shopping_list') {
    const { recipes } = context;
    const ingredients = recipes.flatMap((r) => r.ingredients || []);
    const useMetric = (prefs.recipe_units || 'imperial') === 'metric';
    const unitNote = useMetric ? 'Keep amounts in metric (ml, g, kg).' : 'Keep amounts in imperial (cups, tbsp, oz, lb).';
    return `Consolidate these ingredients into a single shopping list for ${people} people.

Ingredients (from multiple recipes): ${JSON.stringify(ingredients)}

Return a JSON array of objects: { name, totalAmount, unit, category } where category is one of: produce, dairy, meat, pantry, frozen, other.
Combine duplicate items (e.g. "2 cups flour" + "1 cup flour" = "3 cups flour"). ${unitNote}
Return ONLY valid JSON.`;
  }

  return '';
}

const QUICK_EASY_POOLS = {
  breakfast: [
    'Eggs and Bacon', 'Scrambled Eggs', 'Pancakes', 'Waffles', 'Cereal with Milk', 'Oatmeal', 'Toast with Butter', 'Bagel with Cream Cheese',
    'French Toast', 'Eggs and Toast', 'Yogurt with Fruit', 'Peanut Butter Toast', 'Breakfast Sandwich', 'Hash Browns and Eggs',
  ],
  lunch: [
    'Ham and Cheese Sandwich', 'Grilled Cheese', 'PB&J Sandwich', 'Turkey Sandwich', 'Tuna Sandwich', 'Chicken Sandwich',
    'Pizza', 'Hot Dog', 'Mac and Cheese', 'Grilled Cheese and Soup', 'Quesadilla', 'Chicken Nuggets', 'Leftover Pizza',
  ],
  dinner: [
    'Burgers', 'Pizza', 'Steak and Potatoes', 'Chicken Fingers', 'Spaghetti', 'Tacos', 'Hot Dogs', 'Grilled Cheese',
    'Mac and Cheese', 'Meatloaf', 'Fish Sticks', 'Sloppy Joes', 'Grilled Chicken', 'Pork Chops', 'Baked Potato with Toppings',
  ],
};

const MOCK_POOLS = {
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

const FROM_SCRATCH_POOLS = {
  breakfast: [
    'Croissant with Homemade Jam', 'Dutch Baby Pancake', 'Shakshuka with Fresh Herbs', 'Eggs Benedict with Hollandaise',
    'French Crepes from Scratch', 'Sourdough Pancakes', 'Frittata with Seasonal Vegetables', 'Chilaquiles with Salsa Verde',
    'Homemade Granola and Yogurt Parfait', 'Savory Bread Pudding', 'Soufflé Omelette', 'Confit Garlic and Herb Omelette',
  ],
  lunch: [
    'Risotto with Seasonal Vegetables', 'Homemade Ramen with Broth', 'Niçoise Salad with Seared Tuna', 'Pho from Scratch',
    'Hand-Rolled Sushi', 'Cassoulet', 'Paella', 'Mushroom and Leek Galette', 'From-Scratch Chicken Pot Pie',
    'Lobster Roll with Clarified Butter', 'Beef Carpaccio with Arugula', 'Vietnamese Banh Mi with Pickled Vegetables',
  ],
  dinner: [
    'Beef Bourguignon', 'Coq au Vin', 'Beef Wellington', 'Braised Short Ribs', 'Homemade Fresh Pasta with Ragu',
    'Risotto alla Milanese', 'Paella', 'Cassoulet', 'Mole Poblano', 'Osso Buco', 'Lamb Shanks with Rosemary',
    'Duck Confit', 'Seafood Boil with Homemade Spice Blend', 'Layered Lasagna from Scratch', 'Gnocchi with Brown Butter Sage',
  ],
};

function shuffleWithSeed(arr, seed) {
  return [...arr].sort((a, b) => {
    const ha = (seed + a.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 1000;
    const hb = (seed + b.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 1000;
    return ha - hb;
  });
}

function mockMealSuggestions(mealType, countPerLevel, weekStart = '') {
  const count = totalCountFromPerLevel(countPerLevel);
  if (count <= 0) return [];
  const seed = weekStart ? weekStart.split('').reduce((s, c) => s + c.charCodeAt(0), 0) : Date.now();
  const quickPool = (QUICK_EASY_POOLS[mealType] || QUICK_EASY_POOLS.dinner);
  const everydayPool = (MOCK_POOLS[mealType] || MOCK_POOLS.dinner);
  const fromScratchPool = (FROM_SCRATCH_POOLS[mealType] || FROM_SCRATCH_POOLS.dinner);
  const results = [];
  const levels = ['quick_easy', 'everyday', 'from_scratch'];
  for (const level of levels) {
    const n = Math.max(0, Math.floor(countPerLevel[level]) || 0);
    const pool = level === 'quick_easy' ? quickPool : level === 'from_scratch' ? fromScratchPool : everydayPool;
    const shuffled = shuffleWithSeed(pool, seed + level.length);
    const desc = level === 'quick_easy' ? `Simple ${mealType} option.` : level === 'from_scratch' ? `Chef-style ${mealType} from scratch.` : `Delicious ${mealType} option.`;
    for (let i = 0; i < n; i++) {
      results.push({
        name: shuffled[i % shuffled.length],
        description: desc,
        estimatedPrepMinutes: level === 'quick_easy' ? 15 + (i % 10) : level === 'from_scratch' ? 45 + (i % 30) : 20 + (i % 15),
        tags: level === 'quick_easy' ? ['quick', 'simple'] : level === 'from_scratch' ? ['from-scratch', 'chef-style'] : ['balanced'],
        complexity: level,
      });
    }
  }
  return shuffleWithSeed(results, seed);
}

function mockRecipes(meals, recipeUnits = 'imperial') {
  const useMetric = recipeUnits === 'metric';
  const ing1 = useMetric ? { name: 'ingredient 1', amount: 240, unit: 'ml' } : { name: 'ingredient 1', amount: 1, unit: 'cup' };
  const ing2 = useMetric ? { name: 'ingredient 2', amount: 30, unit: 'ml' } : { name: 'ingredient 2', amount: 2, unit: 'tbsp' };
  return meals.map((m) => ({
    name: m.name,
    ingredients: [ing1, ing2],
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

function totalCountFromPerLevel(countPerLevel) {
  if (!countPerLevel || typeof countPerLevel !== 'object') return 0;
  return Object.values(countPerLevel).reduce((a, b) => a + (Number(b) || 0), 0);
}

export async function getMealSuggestions(preferences, mealType, countPerLevel, weekStart) {
  const count = totalCountFromPerLevel(countPerLevel);
  if (count <= 0) return [];

  if (!openai.apiKey) {
    const perLevel = countPerLevel && totalCountFromPerLevel(countPerLevel) > 0
      ? countPerLevel
      : { everyday: count };
    return mockMealSuggestions(mealType, perLevel, weekStart);
  }
  try {
    const prompt = buildPrompt('meal_suggestions', preferences, { mealType, countPerLevel, weekStart });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
    let options = JSON.parse(cleaned);
    if (!Array.isArray(options)) options = [];
    const validLevels = ['quick_easy', 'everyday', 'from_scratch'];
    options.forEach((o) => {
      if (!o.complexity || !validLevels.includes(o.complexity)) o.complexity = 'everyday';
    });
    const unique = deduplicateOptions(options);
    return unique.slice(0, count);
  } catch (err) {
    console.error('AI meal suggestions error:', err.message);
    const mock = mockMealSuggestions(mealType, count, weekStart);
    const levels = Array.isArray(preferences?.meal_complexity_levels) ? preferences.meal_complexity_levels : ['quick_easy', 'everyday', 'from_scratch'];
    return mock.map((m, i) => ({ ...m, complexity: levels[i % levels.length] }));
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
  const recipeUnits = preferences?.recipe_units || 'imperial';

  // 1) Try real recipes from Spoonacular first (one request per meal)
  const apiResults = hasSpoonacular()
    ? await Promise.all(meals.map((m) => getRecipeForMeal(m.name, preferences)))
    : meals.map(() => null);

  const merged = apiResults.map((r) => r ?? null);
  const missedIndices = [];
  const missedMeals = [];
  for (let i = 0; i < meals.length; i++) {
    if (merged[i] == null) {
      missedIndices.push(i);
      missedMeals.push(meals[i]);
    }
  }

  if (missedMeals.length === 0) return merged;

  // 2) Fill misses with AI-generated recipes, or mock if no OpenAI key
  let fallbackRecipes = [];
  if (openai.apiKey) {
    try {
      const prompt = buildPrompt('recipes', preferences, { meals: missedMeals });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      const text = completion.choices[0]?.message?.content?.trim() || '[]';
      const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
      fallbackRecipes = JSON.parse(cleaned);
      if (!Array.isArray(fallbackRecipes)) fallbackRecipes = [];
    } catch (err) {
      console.error('AI recipes error:', err.message);
      fallbackRecipes = mockRecipes(missedMeals, recipeUnits);
    }
  } else {
    fallbackRecipes = mockRecipes(missedMeals, recipeUnits);
  }

  for (let j = 0; j < missedIndices.length; j++) {
    const idx = missedIndices[j];
    const recipe = fallbackRecipes[j];
    merged[idx] = recipe && typeof recipe === 'object'
      ? { ...recipe, name: recipe.name || missedMeals[j]?.name || 'Recipe' }
      : mockRecipes([missedMeals[j]], recipeUnits)[0];
  }

  return merged;
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
