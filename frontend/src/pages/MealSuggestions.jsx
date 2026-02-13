import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meals as api } from '../api';
import { format, startOfWeek, addDays } from 'date-fns';
import Card from '../components/Card';
import Button from '../components/Button';
import './MealSuggestions.css';

export default function MealSuggestions() {
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const navigate = useNavigate();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.suggest(weekStart);
      setPlanId(res.planId);
      setSuggestions(res.suggestions);
      setWeekStart(res.weekStart);
    } catch (err) {
      alert(err.message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (planId) navigate(`/select/${planId}`);
  };

  return (
    <div className="meal-suggestions-page">
      <h1 className="page-title">Generate Meal Options</h1>
      <p className="page-subtitle">
        AI will suggest meal options for each breakfast, lunch, and dinner slot based on your preferences.
      </p>

      <Card className="suggest-card">
        <label className="week-label">
          <span>Week starting</span>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate AI Meal Options'}
        </Button>
      </Card>

      {suggestions.length > 0 && (
        <>
          <div className="suggestions-preview">
            <h2 className="preview-title">Meal Options Generated</h2>
            <p className="preview-desc">
              You have {suggestions.length} meal slots with options. Click below to pick your meals for each slot.
            </p>
            <div className="slots-summary">
              {suggestions.slice(0, 9).map((s, i) => (
                <span key={i} className="slot-badge">
                  {s.mealType} · {s.day}
                </span>
              ))}
              {suggestions.length > 9 && (
                <span className="slot-badge">+{suggestions.length - 9} more</span>
              )}
            </div>
          </div>
          <Button variant="primary" onClick={handleContinue} className="continue-btn">
            Pick Your Meals →
          </Button>
        </>
      )}
    </div>
  );
}
