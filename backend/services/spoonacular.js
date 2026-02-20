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
  if (options.intolerances && options.intolerances.length) {
    params.set('intolerances', options.intolerances.slice(0, 3).join(','));
  }

  try {
    const res = await fetch(`${BASE}/recipes/complexSearch?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
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
    if (!res.ok) return null;
    const data = await res.json();
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
    intolerances: preferences?.dietary_restrictions,
  });
  if (id == null) return null;
  return getRecipeById(id, preferences);
}

export { hasApi };
