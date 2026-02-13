import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { meals as api, calendar as calendarApi, grocery as groceryApi } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import './ShoppingList.css';

const CATEGORY_ORDER = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'other'];

export default function ShoppingList() {
  const { planId } = useParams();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [groceryApps, setGroceryApps] = useState([]);
  const [calendarAuth, setCalendarAuth] = useState(null);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  useEffect(() => {
    api.getPlan(planId)
      .then(setPlan)
      .catch((err) => alert(err.message || 'Failed to load'))
      .finally(() => setLoading(false));

    groceryApi.getApps().then((r) => setGroceryApps(r.apps || [])).catch(() => {});

    calendarApi.getAuthUrl().then((r) => setCalendarAuth(r)).catch(() => {});
  }, [planId]);

  const handleAddToCalendar = async () => {
    if (!plan?.plan?.week_start) return;
    setAddingToCalendar(true);
    try {
      await calendarApi.addEvents(planId, plan.plan.week_start);
    } catch (err) {
      alert(err.message || 'Failed to add to calendar');
    } finally {
      setAddingToCalendar(false);
    }
  };

  const handleCopyList = () => {
    const items = plan?.groceryList || [];
    const text = items.map((i) => `- ${i.name}${i.totalAmount ? ` (${i.totalAmount} ${i.unit || ''})` : ''}`.trim()).join('\n');
    navigator.clipboard.writeText(text).then(() => alert('List copied to clipboard.'));
  };

  if (loading || !plan) return <div className="loading">Loading shopping list…</div>;

  const items = plan.groceryList || [];
  const byCategory = {};
  items.forEach((i) => {
    const cat = (i.category || 'other').toLowerCase();
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });

  const sortedCategories = [...CATEGORY_ORDER].filter((c) => byCategory[c]?.length);
  const rest = Object.keys(byCategory).filter((c) => !CATEGORY_ORDER.includes(c));
  rest.forEach((c) => sortedCategories.push(c));

  return (
    <div className="shopping-list-page">
      <h1 className="page-title">Shopping List</h1>
      <p className="page-subtitle">
        All ingredients consolidated from your meals. Use the links below to order from grocery delivery apps.
      </p>

      <div className="list-actions">
        <Button variant="secondary" onClick={handleCopyList}>
          Copy List
        </Button>
        {calendarAuth?.configured && (
          <Button variant="secondary" onClick={handleAddToCalendar} disabled={addingToCalendar}>
            {addingToCalendar ? 'Adding…' : 'Add to Google Calendar'}
          </Button>
        )}
      </div>

      <Card className="shopping-card">
        {items.length === 0 ? (
          <p className="empty-list">No items yet. Select your meals first.</p>
        ) : (
          <div className="category-list">
            {sortedCategories.map((cat) => (
              <div key={cat} className="category-section">
                <h3 className="category-title">{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
                <ul>
                  {byCategory[cat].map((item, i) => (
                    <li key={i}>
                      <span className="item-name">{item.name}</span>
                      {item.totalAmount && (
                        <span className="item-amount">
                          {item.totalAmount} {item.unit || ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grocery-apps">
        <h2 className="apps-title">Grocery Delivery</h2>
        <p className="apps-desc">Copy your list above and paste into your preferred app, or open one below to order.</p>
        <div className="apps-grid">
          {groceryApps.map((app) => (
            <a
              key={app.id}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="app-card"
            >
              <span className="app-icon">{app.icon}</span>
              <span className="app-name">{app.name}</span>
              <span className="app-desc">{app.description}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
