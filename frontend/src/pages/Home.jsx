import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { meals as api } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import './Home.css';

export default function Home() {
  const [plansOpen, setPlansOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [searchDate, setSearchDate] = useState('');
  const [searchError, setSearchError] = useState('');
  const navigate = useNavigate();

  const PLANS_INITIAL_SHOW = 3;
  const plansToShow = showAllPlans ? plans : plans.slice(0, PLANS_INITIAL_SHOW);
  const hasMorePlans = plans.length > PLANS_INITIAL_SHOW;

  const today = startOfDay(new Date());
  const currentPlan = plans.find((p) => {
    const weekStart = parseISO(p.week_start);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    return isWithinInterval(today, { start: weekStart, end: weekEnd });
  });

  useEffect(() => {
    if (plansOpen && plans.length === 0) {
      setPlansLoading(true);
      api
        .getMyPlans()
        .then((data) => setPlans(data.plans || []))
        .catch(() => setPlans([]))
        .finally(() => setPlansLoading(false));
    }
  }, [plansOpen]);

  const handleSearchDate = async (e) => {
    e.preventDefault();
    if (!searchDate.trim()) return;
    setSearchError('');
    try {
      const data = await api.findPlanByDate(searchDate);
      const planId = data.plan?.id;
      if (planId) navigate(`/recipes/${planId}`);
      else setSearchError('No plan found for that week.');
    } catch {
      setSearchError('No meal plan found for that week.');
    }
  };

  const handleDeletePlan = async (e, planId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this meal plan? This cannot be undone.')) return;
    try {
      await api.deletePlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      alert(err.message || 'Failed to delete plan');
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">AI-Powered Weekly Meal Planning</h1>
        <p className="hero-subtitle">
          Customize your preferences, get personalized meal suggestions, pick your favorites, and get recipes plus a shopping list—all in one place.
        </p>
        <Link to="/preferences">
          <Button variant="primary" className="hero-cta">
            Get Started — Set Your Preferences
          </Button>
        </Link>
      </section>

      <section className="previous-plans-section">
        <button
          type="button"
          className="previous-plans-toggle"
          onClick={() => setPlansOpen((o) => !o)}
          aria-expanded={plansOpen}
        >
          <span className="previous-plans-title">Previous meal plans</span>
          <span className="previous-plans-chevron">{plansOpen ? '▼' : '▶'}</span>
        </button>
        {plansOpen && (
          <div className="previous-plans-dropdown">
            {plansLoading ? (
              <p className="previous-plans-loading">Loading your plans…</p>
            ) : (
              <>
                <div className="previous-plans-current">
                  <h3 className="previous-plans-subtitle">Current week</h3>
                  {currentPlan ? (
                    <Link
                      to={`/recipes/${currentPlan.id}`}
                      className="previous-plans-link"
                      onClick={() => setPlansOpen(false)}
                    >
                      {currentPlan.week_label}
                      {currentPlan.has_selections ? ' · View recipes' : ' · Pick meals'}
                    </Link>
                  ) : (
                    <p className="previous-plans-none">No plan for this week yet. <Link to="/plan">Create one →</Link></p>
                  )}
                </div>
                <div className="previous-plans-search">
                  <h3 className="previous-plans-subtitle">Jump to a date</h3>
                  <form onSubmit={handleSearchDate} className="previous-plans-search-form">
                    <input
                      type="date"
                      value={searchDate}
                      onChange={(e) => { setSearchDate(e.target.value); setSearchError(''); }}
                      className="previous-plans-date-input"
                      aria-label="Search by date"
                    />
                    <Button type="submit" variant="secondary" className="previous-plans-search-btn">
                      Go
                    </Button>
                  </form>
                  {searchError && <p className="previous-plans-search-error">{searchError}</p>}
                </div>
                {plans.length > 0 && (
                  <div className="previous-plans-list">
                    <h3 className="previous-plans-subtitle">All plans</h3>
                    <ul className="previous-plans-ul">
                      {plansToShow.map((p) => (
                        <li key={p.id} className="previous-plans-li">
                          <Link
                            to={`/recipes/${p.id}`}
                            className="previous-plans-link"
                            onClick={() => setPlansOpen(false)}
                          >
                            {p.week_label}
                            {p.has_selections ? '' : ' (no meals selected)'}
                          </Link>
                          <button
                            type="button"
                            className="previous-plans-delete"
                            onClick={(e) => handleDeletePlan(e, p.id)}
                            aria-label={`Delete plan ${p.week_label}`}
                            title="Delete this plan"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                    {hasMorePlans && !showAllPlans && (
                      <button
                        type="button"
                        className="previous-plans-show-more"
                        onClick={() => setShowAllPlans(true)}
                      >
                        Show more
                      </button>
                    )}
                    {hasMorePlans && showAllPlans && (
                      <button
                        type="button"
                        className="previous-plans-show-more"
                        onClick={() => setShowAllPlans(false)}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="steps">
        <h2 className="steps-title">How It Works</h2>
        <div className="steps-grid">
          <Card className="step-card">
            <span className="step-num">1</span>
            <h3>Preferences</h3>
            <p>Set meals per week (breakfast, lunch, dinner), people per meal, dietary restrictions, and macronutrient targets.</p>
            <Link to="/preferences">
              <Button variant="ghost" className="step-link">Configure →</Button>
            </Link>
          </Card>
          <Card className="step-card">
            <span className="step-num">2</span>
            <h3>AI Meal Options</h3>
            <p>AI suggests meal options for each slot. Pick your favorites for the week.</p>
            <Link to="/plan">
              <Button variant="ghost" className="step-link">Plan Week →</Button>
            </Link>
          </Card>
          <Card className="step-card">
            <span className="step-num">3</span>
            <h3>Recipes & Shopping</h3>
            <p>Get detailed recipes and a consolidated shopping list. Sync to calendar and grocery apps.</p>
            <Link to="/integrations">
              <Button variant="ghost" className="step-link">Integrations →</Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
