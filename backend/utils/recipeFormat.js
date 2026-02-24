/**
 * Format recipe ingredient amounts as fractions and normalize units.
 * - Countable items (eggs, peppers, onions, etc.): whole numbers only (2.5 → 3, 0.67 → 1).
 * - No fractions smaller than ¼ (no ⅛).
 * - Replace vague units: handful → cup, dash/pinch → tsp, serving(s) → cup (or tbsp when tiny).
 * - Only standard units: tbsp, tsp, cups, oz, lb (and countable: slice, clove, stalk, head, medium, etc.).
 */

const FRACTIONS = [
  [0.25, '¼'],
  [0.333, '⅓'],
  [0.5, '½'],
  [0.666, '⅔'],
  [0.75, '¾'],
];

const UNIT_NORMALIZE = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsps: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
  cup: 'cup',
  cups: 'cups',
  ounce: 'oz',
  ounces: 'oz',
  ozs: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  gram: 'g',
  grams: 'g',
  milliliter: 'ml',
  milliliters: 'ml',
  litre: 'L',
  liter: 'L',
  liters: 'L',
  litres: 'L',
  clove: 'clove',
  cloves: 'cloves',
  slice: 'slice',
  slices: 'slices',
  stalk: 'stalk',
  stalks: 'stalks',
  medium: 'medium',
  large: 'large',
  small: 'small',
  bunch: 'bunch',
  head: 'head',
  heads: 'heads',
  can: 'can',
  package: 'package',
};

/** Words in ingredient name that indicate a countable item (round to whole number). */
const COUNTABLE_KEYWORDS = [
  'egg', 'pepper', 'onion', 'tomato', 'lime', 'lemon', 'clove', 'stalk', 'slice',
  'banana', 'apple', 'avocado', 'potato', 'plantain', 'fig', 'date', 'celery',
  'carrot', 'cucumber', 'zucchini', 'squash', 'orange', 'grapefruit', 'peach',
  'garlic', 'shallot', 'scallion', 'green onion', 'roma tomato', 'bell pepper',
  'chicken breast', 'fillet', 'steak', 'patty', 'sausage', 'bun', 'pita',
];

/** Units that indicate countable items (amount rounded to whole or ½, ⅓, ¼). */
const COUNTABLE_UNITS = new Set(['clove', 'cloves', 'stalk', 'stalks', 'slice', 'slices', 'medium', 'large', 'small', 'head', 'heads', 'bunch']);

function isCountable(name, unit) {
  const n = (name || '').toLowerCase();
  const u = (unit || '').toLowerCase();
  if (COUNTABLE_UNITS.has(u)) return true;
  return COUNTABLE_KEYWORDS.some((kw) => n.includes(kw));
}

/**
 * Convert decimal amount to fraction string. No fractions smaller than ¼ (round ⅛ to ¼).
 */
export function amountToFraction(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return String(amount ?? '');
  let n = Number(amount);
  if (n <= 0) return '0';
  const whole = Math.floor(n);
  let frac = n - whole;

  if (frac < 0.06) return whole > 0 ? String(whole) : '1';
  if (frac > 0.94) return String(whole + 1);

  if (frac < 0.2) frac = 0.25;
  else if (frac <= 0.3) frac = 0.25;
  else if (frac < 0.45) frac = 0.333;
  else if (frac < 0.55) frac = 0.5;
  else if (frac < 0.7) frac = 0.666;
  else if (frac < 0.85) frac = 0.75;
  else frac = 1;

  if (frac >= 1) return whole > 0 ? String(whole + 1) : '1';
  const fractionStr = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.01)?.[1] || '½';
  if (whole > 0) return `${whole}${fractionStr}`;
  return fractionStr;
}

/**
 * Normalize unit: standard terms only. Handful → cup, dash/pinch → tsp, serving(s) → cup or tbsp.
 * "medium head" / "large head" → "head" (countable).
 */
export function normalizeUnit(unit) {
  if (unit == null || typeof unit !== 'string') return '';
  const u = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!u) return '';
  const key = u.replace(/\.$/, '');
  if (key === 'handful' || key === 'handfuls') return key === 'handfuls' ? 'cups' : 'cup';
  if (key === 'dash' || key === 'dashes' || key === 'pinch' || key === 'pinches') return 'tsp';
  if (key === 'serving' || key === 'servings') return 'cup';
  if (key === 'medium head' || key === 'large head' || key === 'small head') return 'head';
  return UNIT_NORMALIZE[key] || unit.trim();
}

/**
 * Parse amount from API: number or fraction string like "1/2", "1/3", "1/4".
 */
function parseAmount(val) {
  if (val == null) return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim();
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/**
 * Format one ingredient: whole numbers or ½, ⅓, ¼ for measurable; whole numbers for countable. No handful/dash/servings.
 */
export function formatIngredient(ing) {
  if (!ing || typeof ing !== 'object') return ing;
  let amount = parseAmount(ing.amount ?? ing.totalAmount);
  let unit = (ing.unit || '').trim().toLowerCase();
  const name = ing.name || 'ingredient';

  if (amount == null || Number.isNaN(amount)) {
    return {
      name,
      amount: ing.amount ?? ing.totalAmount ?? '',
      unit: normalizeUnit(ing.unit) || undefined,
    };
  }

  if (unit === 'handful' || unit === 'handfuls') {
    unit = unit === 'handfuls' ? 'cups' : 'cup';
    amount = amount < 1 && amount > 0 ? 1 : amount;
  } else if (unit === 'dash' || unit === 'dashes' || unit === 'pinch' || unit === 'pinches') {
    unit = 'tsp';
    amount = 0.25;
  } else if (unit === 'serving' || unit === 'servings') {
    if (amount > 0 && amount < 0.125) {
      unit = 'tbsp';
      amount = Math.max(0.25, amount * 16);
    } else {
      unit = 'cup';
    }
  } else {
    unit = normalizeUnit(ing.unit || '');
  }

  if (isCountable(name, unit)) {
    amount = amount > 0 && amount < 0.5 ? 0.5 : amount;
    const displayAmount = amount >= 1 && amount <= 1.05
      ? '1'
      : amount < 1
        ? amountToFraction(amount)
        : String(Math.floor(amount)) + (amount % 1 > 0.1 ? amountToFraction(amount % 1) : '');
    return {
      name,
      amount: displayAmount,
      unit: unit || undefined,
    };
  }

  return {
    name,
    amount: amountToFraction(amount),
    unit: unit || undefined,
  };
}

/**
 * Format all ingredients in a recipe.
 */
export function formatRecipeIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return ingredients;
  return ingredients.map(formatIngredient);
}
