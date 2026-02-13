import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import './Home.css';

export default function Home() {
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
