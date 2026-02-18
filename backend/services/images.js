import { getImageSearchQueries } from './ai.js';

const PEXELS_KEY = (process.env.PEXELS_API_KEY || '').trim();
const MEAL_TYPE_SEARCHES = { breakfast: 'breakfast food', lunch: 'lunch salad', dinner: 'dinner meal' };

/** Ensure query targets food/dish photos only (avoids people, lifestyle, etc.) */
function toFoodSearchTerm(query) {
  const q = (query || '').trim();
  if (!q) return 'food';
  const lower = q.toLowerCase();
  if (lower.includes(' food') || lower.endsWith(' food') || lower === 'food') return q;
  return `${q} food`;
}

/** Single photo from Pexels - page param gets different result for same query */
async function fetchPexelsOne(query, page = 1) {
  if (!PEXELS_KEY) return null;
  const term = toFoodSearchTerm(query);
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=1&page=${Math.max(1, page)}`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await res.json();
    if (res.status !== 200) return null;
    const img = data?.photos?.[0];
    return img?.src?.small || img?.src?.medium || img?.src?.tiny || null;
  } catch (err) {
    console.error('Pexels fetch error:', err.message);
    return null;
  }
}

/** Fetch up to 5 results for a query - used to pick first unique image per meal */
async function fetchPexelsSeveral(query, limit = 5) {
  if (!PEXELS_KEY) return [];
  const term = toFoodSearchTerm(query);
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=${Math.min(limit, 15)}`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await res.json();
    if (res.status !== 200) return [];
    const photos = data?.photos || [];
    return photos
      .map((p) => p?.src?.small || p?.src?.medium || p?.src?.tiny)
      .filter(Boolean);
  } catch (err) {
    console.error('Pexels fetch error:', err.message);
    return [];
  }
}

/** Multiple different photos in one request */
async function fetchPexelsBulk(query, count = 10, startPage = 1) {
  if (!PEXELS_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(count, 80)}&page=${startPage}`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await res.json();
    if (res.status !== 200) return [];
    const photos = data?.photos || [];
    const urls = [];
    const seen = new Set();
    for (const p of photos) {
      const url = p?.src?.small || p?.src?.medium || p?.src?.tiny;
      if (url && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
    return urls;
  } catch (err) {
    console.error('Pexels bulk fetch error:', err.message);
    return [];
  }
}

export async function addImagesToOptions(options, mealType, useAiQueries = true) {
  // Build one search phrase per meal (AI or name+description) so each photo matches the dish
  let searchQueries = options.map((o) => {
    const text = [o.name, o.description].filter(Boolean).join(' ').trim();
    return text ? `${text} food` : 'food';
  });
  if (useAiQueries) {
    try {
      searchQueries = await getImageSearchQueries(options, mealType);
    } catch {
      // keep default
    }
  }

  const fallbackQuery = MEAL_TYPE_SEARCHES[mealType] || 'food';
  const needed = Math.max(options.length, 10);
  const pageOffset = (Date.now() % 5) + 1;
  let bulkUrls = await fetchPexelsBulk(fallbackQuery, needed, pageOffset);
  if (bulkUrls.length < needed) {
    const more = await fetchPexelsBulk(fallbackQuery, needed, pageOffset + 1);
    bulkUrls = [...bulkUrls, ...more.filter((u) => !bulkUrls.includes(u))];
  }

  const usedUrls = new Set();
  const withImages = [];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const exactQuery = [opt.name, opt.description].filter(Boolean).join(' ').trim();
    const mealQuery = (searchQueries[i] || `${exactQuery || opt.name} food`).trim();

    // Fetch several Pexels results for this meal's query, pick first we haven't used (unique + on-topic)
    let url = null;
    const candidates = [
      ...(await fetchPexelsSeveral(mealQuery, 8)),
      ...(await fetchPexelsSeveral(opt.name, 5)),
    ];
    for (const u of candidates) {
      if (u && !usedUrls.has(u)) {
        url = u;
        break;
      }
    }
    if (url) usedUrls.add(url);

    // If still no unique meal-specific image, try single-result fetch with different pages
    if (!url) {
      for (let page = 1; page <= 5; page++) {
        const u = await fetchPexelsOne(mealQuery, page) || await fetchPexelsOne(opt.name, page);
        if (u && !usedUrls.has(u)) {
          url = u;
          usedUrls.add(url);
          break;
        }
      }
    }

    if (!url && bulkUrls[i] && !usedUrls.has(bulkUrls[i])) {
      url = bulkUrls[i];
      usedUrls.add(url);
    }
    if (!url) {
      url = bulkUrls.find((u) => !usedUrls.has(u)) || bulkUrls[i] || null;
      if (url) usedUrls.add(url);
    }

    withImages.push({ ...opt, imageUrl: url || null });
    if (i < options.length - 1) await new Promise((r) => setTimeout(r, 80));
  }

  return withImages;
}
