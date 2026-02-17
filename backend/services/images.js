const PEXELS_KEY = (process.env.PEXELS_API_KEY || '').trim();
const MEAL_TYPE_SEARCHES = { breakfast: 'breakfast food', lunch: 'lunch salad', dinner: 'dinner meal' };

/** Single photo from Pexels - page param gets different result for same query */
async function fetchPexelsOne(query, page = 1) {
  if (!PEXELS_KEY) return null;
  const term = (query || 'food').trim();
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
  const fallbackQuery = MEAL_TYPE_SEARCHES[mealType] || 'food';
  const needed = Math.max(options.length, 10);

  // Bulk fallback: different start pages to increase variety on refresh
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
    const mealQuery = `${opt.name} food`.trim();
    const page = i + 1;

    let url = (await fetchPexelsOne(mealQuery, page)) || null;
    if (url && usedUrls.has(url)) url = null;
    if (url) usedUrls.add(url);

    if (!url && bulkUrls[i] && !usedUrls.has(bulkUrls[i])) {
      url = bulkUrls[i];
      usedUrls.add(url);
    }
    if (!url) {
      url = bulkUrls.find((u) => !usedUrls.has(u)) || bulkUrls[i] || null;
      if (url) usedUrls.add(url);
    }

    withImages.push({ ...opt, imageUrl: url || null });
    if (i < options.length - 1) await new Promise((r) => setTimeout(r, 50));
  }

  return withImages;
}
