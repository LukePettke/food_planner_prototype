import { Router } from 'express';

const router = Router();

// GET /api/debug/pexels - test Pexels API (for troubleshooting)
router.get('/pexels', async (req, res) => {
  const key = process.env.PEXELS_API_KEY || '';
  const hasKey = !!key.trim();
  if (!hasKey) {
    return res.json({ ok: false, error: 'PEXELS_API_KEY not set in .env' });
  }
  try {
    const res2 = await fetch(
      'https://api.pexels.com/v1/search?query=pancakes+food&per_page=1',
      { headers: { Authorization: key.trim() } }
    );
    const data = await res2.json();
    const img = data?.photos?.[0];
    const url = img?.src?.small || img?.src?.medium || null;
    if (res2.status !== 200) {
      return res.json({
        ok: false,
        status: res2.status,
        error: data?.error || data?.message || 'Pexels API error',
        raw: data,
      });
    }
    res.json({
      ok: true,
      hasResults: !!img,
      sampleUrl: url,
      status: res2.status,
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

export default router;
