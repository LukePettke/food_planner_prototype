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

const MEAL_COMPLEXITY_OPTIONS = [
  { id: 'quick_easy', label: 'Quick & Easy', description: 'Simple recipes, few ingredients, minimal steps—ideal for busy days.' },
  { id: 'everyday', label: 'Everyday', description: 'Familiar dishes with moderate effort and cook time.' },
  { id: 'from_scratch', label: 'From-Scratch', description: 'More involved, chef-style recipes and new techniques.' },
];

const PRESET_APPLIANCES = [
  'Air fryer', 'Instant Pot', 'Slow cooker', 'Pressure cooker', 'Rice cooker',
  'Food processor', 'Blender', 'Stand mixer', 'Toaster oven', 'Grill',
];

export default function Preferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [applianceInput, setApplianceInput] = useState('');
  const [prefs, setPrefs] = useState({
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
    appliances: [],
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
        allergies: Array.isArray(p.allergies) ? p.allergies : [],
        meal_complexity_levels: normalizeMealComplexityLevels(p.meal_complexity_levels),
        protein_per_serving: p.protein_per_serving ?? 25,
        carbs_per_serving: p.carbs_per_serving ?? 40,
        fat_per_serving: p.fat_per_serving ?? 15,
        recipe_units: p.recipe_units === 'metric' ? 'metric' : 'imperial',
        appliances: Array.isArray(p.appliances) ? p.appliances : [],
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

  const addAllergy = () => {
    const name = allergyInput.trim();
    if (!name || prefs.allergies.some((a) => a.toLowerCase() === name.toLowerCase())) return;
    setPrefs({ ...prefs, allergies: [...prefs.allergies, name] });
    setAllergyInput('');
  };

  const removeAllergy = (name) => {
    setPrefs({ ...prefs, allergies: prefs.allergies.filter((a) => a !== name) });
  };

  const applianceList = prefs.appliances || [];
  const toggleAppliance = (name) => {
    const normalized = (name || '').trim();
    if (!normalized) return;
    const next = applianceList.some((a) => a.toLowerCase() === normalized.toLowerCase())
      ? applianceList.filter((a) => a.toLowerCase() !== normalized.toLowerCase())
      : [...applianceList, normalized];
    setPrefs({ ...prefs, appliances: next });
  };

  const addCustomAppliance = () => {
    const name = applianceInput.trim();
    if (!name || applianceList.some((a) => a.toLowerCase() === name.toLowerCase())) return;
    setPrefs({ ...prefs, appliances: [...applianceList, name] });
    setApplianceInput('');
  };

  const removeAppliance = (name) => {
    setPrefs({ ...prefs, appliances: applianceList.filter((a) => a !== name) });
  };

  const validComplexityIds = MEAL_COMPLEXITY_OPTIONS.map((o) => o.id);
  function normalizeMealComplexityLevels(arr) {
    if (!Array.isArray(arr)) return ['quick_easy', 'everyday', 'from_scratch'];
    const filtered = arr.filter((id) => validComplexityIds.includes(id));
    return filtered.length ? filtered : ['everyday'];
  }

  const toggleMealComplexity = (id) => {
    const current = prefs.meal_complexity_levels || [];
    const next = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    if (next.length === 0) return;
    setPrefs({ ...prefs, meal_complexity_levels: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.save(prefs);
      if (res?.preferences) {
        setPrefs({
          breakfasts_per_week: clampMeals(res.preferences.breakfasts_per_week ?? 7),
          lunches_per_week: clampMeals(res.preferences.lunches_per_week ?? 7),
          dinners_per_week: clampMeals(res.preferences.dinners_per_week ?? 7),
          people_per_meal: res.preferences.people_per_meal ?? 1,
          dietary_restrictions: Array.isArray(res.preferences.dietary_restrictions) ? res.preferences.dietary_restrictions : [],
          allergies: Array.isArray(res.preferences.allergies) ? res.preferences.allergies : [],
          meal_complexity_levels: normalizeMealComplexityLevels(res.preferences.meal_complexity_levels),
          protein_per_serving: res.preferences.protein_per_serving ?? 25,
          carbs_per_serving: res.preferences.carbs_per_serving ?? 40,
          fat_per_serving: res.preferences.fat_per_serving ?? 15,
          recipe_units: res.preferences.recipe_units === 'metric' ? 'metric' : 'imperial',
          appliances: Array.isArray(res.preferences.appliances) ? res.preferences.appliances : [],
        });
      }
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
        <h2 className="section-title">Recipe Style</h2>
        <p className="section-desc">Choose one or more styles. You’ll get an equal mix of each selected level in your meal suggestions.</p>
        <div className="complexity-options">
          {MEAL_COMPLEXITY_OPTIONS.map((opt) => {
            const selected = prefs.meal_complexity_levels || [];
            const isChecked = selected.includes(opt.id);
            const isOnlyOne = isChecked && selected.length === 1;
            return (
            <label key={opt.id} className={`complexity-option ${isChecked ? 'checked' : ''} ${isOnlyOne ? 'only-one' : ''}`}>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isOnlyOne}
                onChange={() => toggleMealComplexity(opt.id)}
                title={isOnlyOne ? 'At least one style must be selected' : undefined}
              />
              <span className="complexity-text">
                <span className="complexity-label">{opt.label}</span>
                <span className="complexity-desc">{opt.description}</span>
              </span>
            </label>
            );
          })}
        </div>
      </Card>

      <Card className="pref-section">
        <h2 className="section-title">Recipe Units</h2>
        <p className="section-desc">Choose which measurement system to use in generated recipes and the shopping list.</p>
        <div className="unit-options">
          <label className={`unit-option ${prefs.recipe_units === 'imperial' ? 'active' : ''}`}>
            <input
              type="radio"
              name="recipe_units"
              value="imperial"
              checked={prefs.recipe_units === 'imperial'}
              onChange={() => setPrefs({ ...prefs, recipe_units: 'imperial' })}
            />
            <span className="unit-label">Imperial</span>
            <span className="unit-example">e.g. cups, tbsp, tsp, oz, lb, °F</span>
          </label>
          <label className={`unit-option ${prefs.recipe_units === 'metric' ? 'active' : ''}`}>
            <input
              type="radio"
              name="recipe_units"
              value="metric"
              checked={prefs.recipe_units === 'metric'}
              onChange={() => setPrefs({ ...prefs, recipe_units: 'metric' })}
            />
            <span className="unit-label">Metric</span>
            <span className="unit-example">e.g. ml, g, kg, °C</span>
          </label>
        </div>
      </Card>

      <Card className="pref-section">
        <h2 className="section-title">Kitchen Appliances</h2>
        <p className="section-desc">Select appliances you have (e.g. air fryer, Instant Pot). Meal suggestions and recipes will favor dishes you can make with these.</p>
        <div className="dietary-grid">
          {PRESET_APPLIANCES.map((name) => {
            const isSelected = applianceList.some((a) => a.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                className={`dietary-chip ${isSelected ? 'active' : ''}`}
                onClick={() => toggleAppliance(name)}
              >
                {name}
              </button>
            );
          })}
        </div>
        <h3 className="allergies-subtitle">Add custom appliance</h3>
        <p className="section-desc">Type an appliance name and click Add to include it in your list.</p>
        <div className="allergies-add-row">
          <input
            type="text"
            className="allergy-input"
            placeholder="e.g. Sous vide, Dutch oven, Waffle maker"
            value={applianceInput}
            onChange={(e) => setApplianceInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAppliance())}
          />
          <Button type="button" variant="secondary" onClick={addCustomAppliance}>Add</Button>
        </div>
        {applianceList.length > 0 && (
          <div className="dietary-grid allergies-list">
            {applianceList.map((a) => (
              <span key={a} className="allergy-chip">
                {a}
                <button
                  type="button"
                  className="allergy-chip-remove"
                  onClick={() => removeAppliance(a)}
                  aria-label={`Remove ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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
        <h3 className="allergies-subtitle">Allergies</h3>
        <p className="section-desc">Type an allergy and click Add. Meals and recipes will exclude these ingredients.</p>
        <div className="allergies-add-row">
          <input
            type="text"
            className="allergy-input"
            placeholder="e.g. Peanut, shellfish, dairy"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
          />
          <Button type="button" variant="secondary" onClick={addAllergy}>Add</Button>
        </div>
        {prefs.allergies.length > 0 && (
          <div className="dietary-grid allergies-list">
            {prefs.allergies.map((a) => (
              <span key={a} className="allergy-chip">
                {a}
                <button
                  type="button"
                  className="allergy-chip-remove"
                  onClick={() => removeAllergy(a)}
                  aria-label={`Remove ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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
