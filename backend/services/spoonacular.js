/**
 * Spoonacular recipe API: search by name, then fetch full recipe.
 * Used for hybrid recipe flow (real recipes first, AI fallback).
 */

const BASE = 'https://api.spoonacular.com';

function getApiKey() {
  return (process.env.SPOONACULAR_API_KEY || '').trim();
}

function hasApi() {
  return !!getApiKey();
}

/** True if the API response indicates quota/limit or other non-success. */
function isSpoonacularErrorResponse(res, data) {
  if (!res.ok) return true;
  const msg = (data?.message || data?.status || '').toString();
  return msg.includes('points limit') || msg.includes('daily limit');
}

/**
 * Search for a recipe by name. Returns the first result's id or null.
 * @param {string} query - Meal/recipe name (e.g. "Salmon Teriyaki")
 * @param {object} options - { diet, intolerances } from preferences (optional)
 * @returns {Promise<number|null>} - Recipe id or null
 */
export async function searchRecipe(query, options = {}) {
  const key = getApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    apiKey: key,
    query: (query || '').trim() || 'recipe',
    number: 1,
    instructionsRequired: 'true',
  });
  if (options.diet) params.set('diet', mapDiet(options.diet));
  const intolerances = options.intolerances && options.intolerances.length
    ? options.intolerances
    : mapAllergiesToIntolerances(options.allergies || []);
  if (intolerances.length) {
    params.set('intolerances', intolerances.slice(0, 5).join(','));
  }

  try {
    const res = await fetch(`${BASE}/recipes/complexSearch?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (isSpoonacularErrorResponse(res, data)) {
      if (process.env.NODE_ENV !== 'production' && data?.message) {
        console.warn('Spoonacular quota/error:', data.message);
      }
      return null;
    }
    const id = data?.results?.[0]?.id;
    return id != null ? id : null;
  } catch (err) {
    console.error('Spoonacular search error:', err.message);
    return null;
  }
}

function mapDiet(dietaryRestrictions) {
  if (!Array.isArray(dietaryRestrictions) || dietaryRestrictions.length === 0) return '';
  const d = dietaryRestrictions.map((x) => x.toLowerCase());
  if (d.some((x) => x.includes('vegetarian'))) return 'vegetarian';
  if (d.some((x) => x.includes('vegan'))) return 'vegan';
  if (d.some((x) => x.includes('keto'))) return 'ketogenic';
  if (d.some((x) => x.includes('paleo'))) return 'paleo';
  return '';
}

/** Map app allergy labels to Spoonacular intolerance parameter values. */
function mapAllergiesToIntolerances(allergies) {
  if (!Array.isArray(allergies) || allergies.length === 0) return [];
  const mapping = {
    peanut: 'peanut',
    'tree nuts': 'tree nut',
    shellfish: 'shellfish',
    fish: 'seafood',
    dairy: 'dairy',
    egg: 'egg',
    soy: 'soy',
    wheat: 'wheat',
    sesame: 'sesame',
  };
  const out = [];
  for (const a of allergies) {
    const key = (a || '').toLowerCase().trim();
    const val = mapping[key];
    if (val && !out.includes(val)) out.push(val);
  }
  return out;
}

/**
 * Fetch full recipe by id and map to app format.
 * @param {number} recipeId - Spoonacular recipe id
 * @param {object} preferences - { people_per_meal, recipe_units }
 * @returns {Promise<object|null>} - { name, ingredients, instructions, prepMinutes, cookMinutes, macronutrients } or null
 */
export async function getRecipeById(recipeId, preferences = {}) {
  const key = getApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    apiKey: key,
    includeNutrition: 'true',
  });

  try {
    const res = await fetch(`${BASE}/recipes/${recipeId}/information?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (isSpoonacularErrorResponse(res, data)) return null;
    return mapToAppRecipe(data, preferences);
  } catch (err) {
    console.error('Spoonacular getRecipe error:', err.message);
    return null;
  }
}

/**
 * Map Spoonacular recipe to our format. Scale ingredients to people_per_meal; use metric or imperial.
 */
function mapToAppRecipe(data, preferences) {
  const servings = Number(data.servings) || 1;
  const wantServings = Math.max(1, Number(preferences.people_per_meal) || 1);
  const scale = wantServings / servings;
  const useMetric = (preferences.recipe_units || 'imperial') === 'metric';

  const ingredients = (data.extendedIngredients || []).map((ing) => {
    let amount = ing.amount;
    let unit = ing.unit || '';
    if (useMetric && ing.measures?.metric) {
      amount = ing.measures.metric.amount;
      unit = ing.measures.metric.unitShort || ing.measures.metric.unitLong || unit;
    } else if (!useMetric && ing.measures?.us) {
      amount = ing.measures.us.amount;
      unit = ing.measures.us.unitShort || ing.measures.us.unitLong || unit;
    }
    amount = Math.round((amount * scale) * 100) / 100;
    return {
      name: ing.name || ing.originalName || 'ingredient',
      amount: amount,
      unit: (unit || '').trim() || undefined,
    };
  });

  const steps = (data.analyzedInstructions || [])[0]?.steps || [];
  const instructions = steps
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .map((s) => (s.step || '').trim())
    .filter(Boolean);
  if (instructions.length === 0 && data.instructions) {
    instructions.push(data.instructions.trim());
  }
  if (instructions.length === 0) {
    instructions.push('Follow your preferred method for this dish.');
  }

  const readyMinutes = Number(data.readyInMinutes) || 30;
  const prepMinutes = Number(data.preparationMinutes) || Math.floor(readyMinutes * 0.4);
  const cookMinutes = Number(data.cookingMinutes) || Math.floor(readyMinutes * 0.6);

  let macronutrients = { protein: 25, carbs: 40, fat: 15 };
  const nutrients = data.nutrition?.nutrients || [];
  const getNutrient = (name) => {
    const n = nutrients.find((x) => (x.name || '').toLowerCase() === name);
    return n != null ? Number(n.amount) : undefined;
  };
  const protein = getNutrient('protein');
  const carbs = getNutrient('carbohydrates');
  const fat = getNutrient('fat');
  if (protein != null || carbs != null || fat != null) {
    const perServing = Math.max(1, servings);
    macronutrients = {
      protein: Math.round((protein ?? macronutrients.protein) / perServing),
      carbs: Math.round((carbs ?? macronutrients.carbs) / perServing),
      fat: Math.round((fat ?? macronutrients.fat) / perServing),
    };
  }

  return {
    name: data.title || 'Recipe',
    ingredients,
    instructions,
    prepMinutes,
    cookMinutes,
    macronutrients,
  };
}

/**
 * Try to get a real recipe for one meal. Returns null if not found or API unavailable.
 */
export async function getRecipeForMeal(mealName, preferences) {
  if (!hasApi()) return null;
  const id = await searchRecipe(mealName, {
    diet: preferences?.dietary_restrictions,
    allergies: preferences?.allergies,
  });
  if (id == null) return null;
  return getRecipeById(id, preferences);
}

/** Call Spoonacular with a minimal request to verify API key. Returns { ok, keySet, error? }. */
export async function verifySpoonacularKey() {
  const key = getApiKey();
  if (!key) {
    return { ok: false, keySet: false, error: 'SPOONACULAR_API_KEY not set in .env' };
  }
  try {
    const res = await fetch(`${BASE}/recipes/complexSearch?apiKey=${encodeURIComponent(key)}&query=pasta&number=1`);
    const data = await res.json().catch(() => ({}));
    const msg = data?.message || data?.status || '';
    const isQuotaError = typeof msg === 'string' && (msg.includes('points limit') || msg.includes('daily limit') || res.status === 402 || res.status === 429);
    if (isQuotaError) {
      return {
        ok: false,
        keySet: true,
        error: 'Spoonacular daily limit (50 points) reached. The app will use OpenAI for recipes until the limit resets (usually midnight UTC).',
      };
    }
    if (res.status === 401) {
      return { ok: false, keySet: true, error: 'Invalid or unauthorized API key' };
    }
    if (!res.ok) {
      return { ok: false, keySet: true, error: msg || res.statusText || `HTTP ${res.status}` };
    }
    return { ok: true, keySet: true };
  } catch (err) {
    return { ok: false, keySet: true, error: err.message };
  }
}

export { hasApi };
