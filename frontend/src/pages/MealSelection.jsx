import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meals as api } from '../api';
import { format } from 'date-fns';
import Card from '../components/Card';
import Button from '../components/Button';
import './MealSelection.css';

export default function MealSelection() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState(null);
  const [selections, setSelections] = useState({}); // key: `${mealType}-${dayIndex}`

  useEffect(() => {
    api.getPlan(planId)
      .then((data) => {
        setPlan(data);
        const initial = {};
        (data.plan?.meals || []).forEach((slot, i) => {
          const key = `${slot.mealType}-${slot.dayIndex}`;
          if (slot.options?.[0]) initial[key] = slot.options[0];
        });
        setSelections(initial);
      })
      .catch((err) => {
        alert(err.message || 'Failed to load plan');
        navigate('/plan');
      })
      .finally(() => setLoading(false));
  }, [planId, navigate]);

  const updateSelection = (key, meal) => {
    setSelections((prev) => ({ ...prev, [key]: meal }));
  };

  const handleSubmit = async () => {
    const slots = plan?.plan?.meals || [];
    const selectionsList = slots.map((slot) => {
      const key = `${slot.mealType}-${slot.dayIndex}`;
      const meal = selections[key] || slot.options?.[0];
      return { mealType: slot.mealType, dayIndex: slot.dayIndex, meal };
    }).filter((s) => s.meal);

    if (selectionsList.length === 0) {
      alert('Please select at least one meal per slot.');
      return;
    }

    setSubmitting(true);
    try {
      await api.select(planId, selectionsList);
      navigate(`/recipes/${planId}`);
    } catch (err) {
      alert(err.message || 'Failed to save selections');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !plan) return <div className="loading">Loading meal options…</div>;

  const slots = plan.plan?.meals || [];

  return (
    <div className="meal-selection-page">
      <h1 className="page-title">Pick Your Meals</h1>
      <p className="page-subtitle">
        Choose one meal for each slot. You'll get recipes and a shopping list next.
      </p>

      <div className="slots-list">
        {slots.map((slot, idx) => {
          const key = `${slot.mealType}-${slot.dayIndex}`;
          const selected = selections[key] || slot.options?.[0];
          return (
            <Card key={idx} className="slot-card">
              <h3 className="slot-header">
                {slot.mealType.charAt(0).toUpperCase() + slot.mealType.slice(1)} — {slot.day}
              </h3>
              <div className="meal-options">
                {(slot.options || []).map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`meal-option ${selected?.name === opt.name ? 'selected' : ''}`}
                    onClick={() => updateSelection(key, opt)}
                  >
                    <span className="option-name">{opt.name}</span>
                    <span className="option-desc">{opt.description}</span>
                    <span className="option-meta">
                      ~{opt.estimatedPrepMinutes || 25} min · {(opt.tags || []).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="selection-actions">
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Generating recipes…' : 'Confirm & Get Recipes'}
        </Button>
      </div>
    </div>
  );
}
