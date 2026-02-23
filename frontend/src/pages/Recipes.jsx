import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { meals as api } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import './Recipes.css';

export default function Recipes() {
  const { planId } = useParams();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    api.getPlan(planId)
      .then(setPlan)
      .catch((err) => alert(err.message || 'Failed to load plan'))
      .finally(() => setLoading(false));
  }, [planId]);

  const handleRegenerateRecipes = async () => {
    setRegenerating(true);
    try {
      const data = await api.regenerateRecipes(planId);
      setPlan(data);
    } catch (err) {
      alert(err.message || 'Failed to regenerate recipes. Check that OPENAI_API_KEY or SPOONACULAR_API_KEY is set in backend .env');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <div className="loading">Loading recipes…</div>;
  if (!plan?.selectedMeals?.length) {
    return (
      <div className="recipes-empty">
        <p>No selected meals yet. Pick your meals first.</p>
        <Link to={`/select/${planId}`}>
          <Button variant="primary">Pick Meals</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="recipes-page">
      <h1 className="page-title">Your Recipes</h1>
      <p className="page-subtitle">
        Detailed recipes for your selected meals. Head to the shopping list when you're ready.
      </p>

      <div className="recipes-actions recipes-actions-top">
        <Button
          type="button"
          variant="secondary"
          onClick={handleRegenerateRecipes}
          disabled={regenerating}
        >
          {regenerating ? 'Fetching real recipes…' : 'Regenerate recipes'}
        </Button>
      </div>

      <div className="recipes-list">
        {plan.selectedMeals.map((m, i) => {
          const recipe = m.recipe || {};
          const isExpanded = expanded === i;
          return (
            <Card key={i} className="recipe-card">
              <button
                type="button"
                className="recipe-header"
                onClick={() => setExpanded(isExpanded ? null : i)}
              >
                <div>
                  <h3 className="recipe-name">{m.meal_name}</h3>
                  <span className="recipe-meta">
                    {m.meal_type} · {recipe.prepMinutes || 15} min prep · {recipe.cookMinutes || 25} min cook
                  </span>
                </div>
                <span className="recipe-toggle">{isExpanded ? '−' : '+'}</span>
              </button>
              {isExpanded && (
                <div className="recipe-body">
                  <div className="recipe-section">
                    <h4>Ingredients</h4>
                    <ul>
                      {(recipe.ingredients || m.ingredients || []).map((ing, j) => {
                        const item = typeof ing === 'string' ? { name: ing, amount: '', unit: '' } : (ing || {});
                        return (
                          <li key={j}>
                            {item.amount != null && item.amount !== '' && `${item.amount} `}
                            {(item.unit || '').trim() && `${item.unit} `}
                            {item.name || 'Ingredient'}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="recipe-section">
                    <h4>Instructions</h4>
                    <ol>
                      {(recipe.instructions || []).map((step, j) => (
                        <li key={j}>{typeof step === 'string' ? step : (step?.step ?? step?.text ?? String(step))}</li>
                      ))}
                    </ol>
                  </div>
                  {recipe.macronutrients && (
                    <div className="recipe-macros">
                      <span>Protein {recipe.macronutrients.protein}g</span>
                      <span>Carbs {recipe.macronutrients.carbs}g</span>
                      <span>Fat {recipe.macronutrients.fat}g</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="recipes-actions">
        <Link to={`/shopping/${planId}`}>
          <Button variant="primary">View Shopping List</Button>
        </Link>
      </div>
    </div>
  );
}
