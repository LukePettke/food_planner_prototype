import { Router } from 'express';

const router = Router();

// Grocery delivery app links - these are affiliate/referral style links
// In production, you'd integrate with actual APIs (Instacart, Amazon Fresh, etc.)
const GROCERY_APPS = [
  {
    id: 'instacart',
    name: 'Instacart',
    url: 'https://www.instacart.com',
    description: 'Same-day delivery from local stores',
    icon: '🛒',
  },
  {
    id: 'amazon-fresh',
    name: 'Amazon Fresh',
    url: 'https://www.amazon.com/amazonfresh',
    description: 'Fresh groceries from Amazon',
    icon: '📦',
  },
  {
    id: 'walmart',
    name: 'Walmart Grocery',
    url: 'https://www.walmart.com/grocery',
    description: 'Pickup and delivery',
    icon: '🏪',
  },
  {
    id: 'target',
    name: 'Target Same Day Delivery',
    url: 'https://www.target.com/c/grocery/-/N-5xt1a',
    description: 'Shipt-powered delivery',
    icon: '🎯',
  },
];

// GET /api/grocery/apps
router.get('/apps', (req, res) => {
  res.json({ apps: GROCERY_APPS });
});

// POST /api/grocery/export - generate shareable list for external apps
router.post('/export', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' });
  }
  const textList = items.map((i) => `- ${i.name}${i.totalAmount ? ` (${i.totalAmount} ${i.unit || ''})`.trim() : ''}`).join('\n');
  res.json({
    plainText: textList,
    items,
    message: 'Copy the list above and paste into your preferred grocery app, or use the links below.',
  });
});

export default router;
