import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meals as api } from '../api';
import { format, startOfWeek } from 'date-fns';
import Card from '../components/Card';
import Button from '../components/Button';
import './MealSuggestions.css';

export default function MealSuggestions() {
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [optionCounts, setOptionCounts] = useState(null);
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const navigate = useNavigate();

  const handleGenerate = async () => {
    setLoading(true);
    setOptionCounts(null);
    try {
      const res = await api.suggest(weekStart);
      setPlanId(res.planId);
      setSuggestions(res.suggestions);
      setOptionCounts(res.optionCounts || null);
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

      {((Array.isArray(suggestions) && suggestions.length > 0) || (suggestions?.breakfastOptions)) && (
        <>
          <div className="suggestions-preview">
            <h2 className="preview-title">Meal Options Generated</h2>
            <p className="preview-desc">
              Two options per meal slot (based on your preferences). Drag meals into slots on the next screen.
            </p>
            {optionCounts && (
              <p className="preview-counts">
                {optionCounts.breakfast} breakfast · {optionCounts.lunch} lunch · {optionCounts.dinner} dinner options
              </p>
            )}
          </div>
          <Button variant="primary" onClick={handleContinue} className="continue-btn">
            Pick Your Meals →
          </Button>
        </>
      )}
    </div>
  );
}
