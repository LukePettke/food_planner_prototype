import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { preferences as api } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import './Preferences.css';

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free',
  'Nut-free', 'Keto', 'Paleo', 'Low-carb', 'Low-sodium', 'Halal', 'Kosher',
];

export default function Preferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    breakfasts_per_week: 7,
    lunches_per_week: 7,
    dinners_per_week: 7,
    people_per_meal: 1,
    dietary_restrictions: [],
    protein_per_serving: 25,
    carbs_per_serving: 40,
    fat_per_serving: 15,
  });

  const clampMeals = (n) => Math.max(0, Math.min(7, Math.floor(Number(n)) || 0));

  useEffect(() => {
    api.get()
      .then((p) => setPrefs({
        breakfasts_per_week: clampMeals(p.breakfasts_per_week ?? 7),
        lunches_per_week: clampMeals(p.lunches_per_week ?? 7),
        dinners_per_week: clampMeals(p.dinners_per_week ?? 7),
        people_per_meal: p.people_per_meal ?? 1,
        dietary_restrictions: Array.isArray(p.dietary_restrictions) ? p.dietary_restrictions : [],
        protein_per_serving: p.protein_per_serving ?? 25,
        carbs_per_serving: p.carbs_per_serving ?? 40,
        fat_per_serving: p.fat_per_serving ?? 15,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDietary = (name) => {
    const next = prefs.dietary_restrictions.includes(name)
      ? prefs.dietary_restrictions.filter((d) => d !== name)
      : [...prefs.dietary_restrictions, name];
    setPrefs({ ...prefs, dietary_restrictions: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.save(prefs);
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading preferences…</div>;

  return (
    <div className="preferences-page">
      <h1 className="page-title">Your Preferences</h1>
      <p className="page-subtitle">Customize your weekly meal plan. These settings are used by AI to suggest meals.</p>

      <Card className="pref-section">
        <h2 className="section-title">Meals Per Week</h2>
        <p className="section-desc">How many breakfasts, lunches, and dinners do you plan each week?</p>
        <div className="meal-counts">
          <label>
            <span>Breakfasts</span>
            <input
              type="number"
              min={0}
              max={7}
              value={prefs.breakfasts_per_week}
              onChange={(e) => setPrefs({ ...prefs, breakfasts_per_week: Math.max(0, Math.min(7, +e.target.value || 0)) })}
            />
          </label>
          <label>
            <span>Lunches</span>
            <input
              type="number"
              min={0}
              max={7}
              value={prefs.lunches_per_week}
              onChange={(e) => setPrefs({ ...prefs, lunches_per_week: Math.max(0, Math.min(7, +e.target.value || 0)) })}
            />
          </label>
          <label>
            <span>Dinners</span>
            <input
              type="number"
              min={0}
              max={7}
              value={prefs.dinners_per_week}
              onChange={(e) => setPrefs({ ...prefs, dinners_per_week: Math.max(0, Math.min(7, +e.target.value || 0)) })}
            />
          </label>
        </div>
      </Card>

      <Card className="pref-section">
        <h2 className="section-title">People Per Meal</h2>
        <p className="section-desc">How many people will you be feeding? Recipes and shopping list will be scaled accordingly.</p>
        <label className="people-input">
          <input
            type="number"
            min={1}
            max={20}
            value={prefs.people_per_meal}
            onChange={(e) => setPrefs({ ...prefs, people_per_meal: Math.max(1, Math.min(20, +e.target.value || 1)) })}
          />
          <span>people</span>
        </label>
      </Card>

      <Card className="pref-section">
        <h2 className="section-title">Dietary Restrictions</h2>
        <p className="section-desc">Select any that apply. AI will avoid these ingredients or adapt recipes.</p>
        <div className="dietary-grid">
          {DIETARY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`dietary-chip ${prefs.dietary_restrictions.includes(d) ? 'active' : ''}`}
              onClick={() => toggleDietary(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card className="pref-section">
        <h2 className="section-title">Macronutrients Per Serving</h2>
        <p className="section-desc">Target grams per serving. AI will aim for meals that fit these targets.</p>
        <div className="macro-grid">
          <label>
            <span>Protein (g)</span>
            <input
              type="number"
              min={0}
              max={200}
              value={prefs.protein_per_serving}
              onChange={(e) => setPrefs({ ...prefs, protein_per_serving: Math.max(0, Math.min(200, +e.target.value || 0)) })}
            />
          </label>
          <label>
            <span>Carbs (g)</span>
            <input
              type="number"
              min={0}
              max={200}
              value={prefs.carbs_per_serving}
              onChange={(e) => setPrefs({ ...prefs, carbs_per_serving: Math.max(0, Math.min(200, +e.target.value || 0)) })}
            />
          </label>
          <label>
            <span>Fat (g)</span>
            <input
              type="number"
              min={0}
              max={200}
              value={prefs.fat_per_serving}
              onChange={(e) => setPrefs({ ...prefs, fat_per_serving: Math.max(0, Math.min(200, +e.target.value || 0)) })}
            />
          </label>
        </div>
      </Card>

      <div className="pref-actions">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </Button>
        <Link to="/plan">
          <Button variant="secondary">Continue to Plan Week →</Button>
        </Link>
      </div>
    </div>
  );
}
