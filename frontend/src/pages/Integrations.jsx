import { useState, useEffect } from 'react';
import { calendar as api, grocery as groceryApi } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import './Integrations.css';

export default function Integrations() {
  const [calendarAuth, setCalendarAuth] = useState(null);
  const [groceryApps, setGroceryApps] = useState([]);

  useEffect(() => {
    api.getAuthUrl().then(setCalendarAuth).catch(() => {});
    groceryApi.getApps().then((r) => setGroceryApps(r.apps || [])).catch(() => {});
  }, []);

  const handleGoogleConnect = () => {
    const redirectUri = `${window.location.origin}/integrations`;
    api.getAuthUrl(redirectUri)
      .then((r) => {
        if (r.authUrl) window.location.href = r.authUrl;
      })
      .catch(console.error);
  };

  const isCallback = typeof window !== 'undefined' && window.location.search.includes('code=');
  useEffect(() => {
    if (isCallback) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const redirectUri = `${window.location.origin}/integrations`;
        api.exchangeToken(code, redirectUri)
          .then(() => {
            window.history.replaceState({}, '', '/integrations');
            window.location.reload();
          })
          .catch((err) => alert(err.message || 'Failed to connect'));
      }
    }
  }, [isCallback]);

  return (
    <div className="integrations-page">
      <h1 className="page-title">Integrations</h1>
      <p className="page-subtitle">
        Connect your calendar and grocery delivery apps to streamline meal planning.
      </p>

      <Card className="integration-card">
        <div className="integration-header">
          <span className="integration-icon">📅</span>
          <div>
            <h2 className="integration-name">Google Calendar</h2>
            <p className="integration-desc">
              Add your meal plan events to Google Calendar. Each meal appears as an event on the correct day.
            </p>
          </div>
        </div>
        {calendarAuth?.configured === false ? (
          <p className="integration-note">
            Google Calendar is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend .env file.
          </p>
        ) : (
          <Button variant="primary" onClick={handleGoogleConnect}>
            Connect Google Calendar
          </Button>
        )}
      </Card>

      <Card className="integration-card">
        <div className="integration-header">
          <span className="integration-icon">🛒</span>
          <div>
            <h2 className="integration-name">Grocery Delivery</h2>
            <p className="integration-desc">
              Copy your shopping list and paste it into your preferred grocery app, or open one of these to order.
            </p>
          </div>
        </div>
        <div className="apps-list">
          {groceryApps.map((app) => (
            <a
              key={app.id}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="app-link"
            >
              <span>{app.icon}</span>
              <span>{app.name}</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
