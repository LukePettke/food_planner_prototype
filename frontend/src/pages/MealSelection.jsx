import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meals as api } from '../api';
import Button from '../components/Button';
import './MealSelection.css';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// 10 distinct Pexels food photos per category - used when API returns duplicates
const FALLBACK_IMAGES = {
  breakfast: [
    'https://images.pexels.com/photos/2516025/pexels-photo-2516025.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/3763815/pexels-photo-3763815.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/2299028/pexels-photo-2299028.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1683545/pexels-photo-1683545.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/209487/pexels-photo-209487.jpeg?auto=compress&cs=tinysrgb&h=130',
  ],
  lunch: [
    'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/3255237/pexels-photo-3255237.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/2347311/pexels-photo-2347311.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/724664/pexels-photo-724664.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&h=130',
  ],
  dinner: [
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/2347311/pexels-photo-2347311.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/3255237/pexels-photo-3255237.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/724664/pexels-photo-724664.jpeg?auto=compress&cs=tinysrgb&h=130',
    'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&h=130',
  ],
};

function getFallbackImage(mealType, index = 0) {
  const arr = FALLBACK_IMAGES[mealType] || FALLBACK_IMAGES.breakfast;
  return Array.isArray(arr) ? arr[index % arr.length] : arr || FALLBACK_IMAGES.breakfast?.[0];
}


export default function MealSelection() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [plan, setPlan] = useState(null);
  // assignments: { breakfast: { 0: meal, 1: meal, ... }, lunch: {...}, dinner: {...} }
  const [assignments, setAssignments] = useState({ breakfast: {}, lunch: {}, dinner: {} });
  const [dragItem, setDragItem] = useState(null); // { mealType, meal }

  useEffect(() => {
    let cancelled = false;
    api.getPlan(planId)
      .then(async (data) => {
        if (cancelled) return;
        setPlan(data);
        const meals = data.plan?.meals;
        if (!meals) return;
        if (meals.breakfastOptions) {
          setAssignments({ breakfast: {}, lunch: {}, dinner: {} });
          // Auto-refresh photos if placeholders or all options share the same image (stale data)
          const opts = meals.breakfastOptions || [];
          const first = opts[0];
          const hasPlaceholder = !first?.imageUrl || String(first.imageUrl).includes('placehold.co');
          const allSameImage = opts.length > 1 && opts.every((o) => o?.imageUrl === first?.imageUrl);
          if (hasPlaceholder || allSameImage) {
            setRefreshingImages(true);
            try {
              const data = await api.refreshImages(planId);
              if (!cancelled && data?.plan) setPlan(data);
              else if (!cancelled) {
                const updated = await api.getPlan(planId);
                setPlan(updated);
              }
            } catch {
              // ignore - keep placeholder
            } finally {
              if (!cancelled) setRefreshingImages(false);
            }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) alert(err.message || 'Failed to load plan');
        if (!cancelled) navigate('/plan');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [planId, navigate]);

  const getOptions = (mealType) => {
    const meals = plan?.plan?.meals;
    if (!meals) return [];
    if (meals[`${mealType}Options`]) return meals[`${mealType}Options`];
    // Legacy: take first slot's options for this meal type
    const slot = Array.isArray(meals) && meals.find((s) => s.mealType === mealType);
    return slot?.options || [];
  };

  const handleDragStart = (e, mealType, meal) => {
    setDragItem({ mealType, meal });
    e.dataTransfer.setData('text/plain', JSON.stringify({ mealType, meal }));
    e.dataTransfer.effectAllowed = 'copy';
    e.target.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDragItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drop-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drop-over');
  };

  const handleDrop = (e, mealType, dayIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-over');
    let data;
    try {
      data = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (data.mealType !== mealType) return; // can only drop breakfast into breakfast, etc.
    setAssignments((prev) => ({
      ...prev,
      [mealType]: { ...prev[mealType], [dayIndex]: data.meal },
    }));
  };

  const handleRefreshImages = async () => {
    setRefreshingImages(true);
    try {
      const data = await api.refreshImages(planId);
      if (data.plan) {
        setPlan(data);
      } else {
        const updated = await api.getPlan(planId);
        setPlan(updated);
      }
    } catch (err) {
      alert(err.message || 'Failed to refresh photos. Check that the backend is running.');
    } finally {
      setRefreshingImages(false);
    }
  };

  const removeAssignment = (mealType, dayIndex) => {
    setAssignments((prev) => {
      const next = { ...prev[mealType] };
      delete next[dayIndex];
      return { ...prev, [mealType]: next };
    });
  };

  const handleSubmit = async () => {
    const count = Object.values(assignments).reduce(
      (sum, days) => sum + Object.keys(days).length,
      0
    );
    if (count === 0) {
      alert('Please drag at least one meal to a day.');
      return;
    }

    setSubmitting(true);
    try {
      await api.select(planId, { assignments });
      navigate(`/recipes/${planId}`);
    } catch (err) {
      alert(err.message || 'Failed to save selections');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !plan) return <div className="loading">Loading meal options…</div>;

  const meals = plan.plan?.meals;
  const dayLabels = meals?.dayLabels || DAY_LABELS;

  return (
    <div className="meal-selection-page meal-selection-compact">
      <h1 className="page-title">Pick Your Meals</h1>
      <p className="page-subtitle">
        Drag a meal from the options into a day. You can assign the same meal to multiple days.
      </p>

      {meals?.breakfastOptions && (
        <button
          type="button"
          className="refresh-photos-btn"
          onClick={handleRefreshImages}
          disabled={refreshingImages}
        >
          {refreshingImages ? 'Loading photos…' : 'Refresh photos'}
        </button>
      )}

      {!meals?.breakfastOptions && !Array.isArray(meals) && (
        <p className="empty-plan-notice">
          No meal options found. Please go back to <button type="button" className="link-btn" onClick={() => navigate('/plan')}>Plan</button> and generate new meal options.
        </p>
      )}

      {MEAL_TYPES.map((mealType) => {
        const options = getOptions(mealType);
        const assigned = assignments[mealType] || {};

        return (
          <div key={mealType} className="meal-section">
            <h2 className="meal-section-title">
              {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </h2>

            {/* 10 options in 2 rows of 5 */}
            <div className="options-grid">
              {(options.length ? options : Array(10).fill(null)).map((opt, i) => (
                <div
                  key={i}
                  className={`option-card ${dragItem?.meal?.name === opt?.name ? 'dragging' : ''}`}
                  draggable={!!opt}
                  onDragStart={(e) => opt && handleDragStart(e, mealType, opt)}
                  onDragEnd={handleDragEnd}
                >
                  {opt ? (
                    <>
                      <img
                        src={opt.imageUrl || getFallbackImage(mealType, i)}
                        alt={opt.name}
                        className="option-img"
                        draggable={false}
                        onError={(e) => {
                          e.target.src = getFallbackImage(mealType, i);
                        }}
                      />
                      <span className="option-name">{opt.name}</span>
                    </>
                  ) : (
                    <span className="option-placeholder">—</span>
                  )}
                </div>
              ))}
            </div>

            {/* 7 day drop zones */}
            <div className="days-row">
              {dayLabels.map((label, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`day-cell ${assigned[dayIndex] ? 'has-meal' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, mealType, dayIndex)}
                >
                  <span className="day-label">{label}</span>
                  {assigned[dayIndex] ? (
                    <div className="assigned-meal">
                      <img
                        src={assigned[dayIndex].imageUrl || getFallbackImage(mealType, dayIndex)}
                        alt=""
                        className="assigned-img"
                        onError={(e) => {
                          e.target.src = getFallbackImage(mealType, dayIndex);
                        }}
                      />
                      <span className="assigned-name">{assigned[dayIndex].name}</span>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeAssignment(mealType, dayIndex)}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="drop-hint">Drop here</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="selection-actions">
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Generating recipes…' : 'Confirm & Get Recipes'}
        </Button>
      </div>
    </div>
  );
}
