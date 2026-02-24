import { useState, useEffect } from 'react';
import { grocery as groceryApi } from '../api';
import Card from '../components/Card';
import './Integrations.css';

export default function Integrations() {
  const [groceryApps, setGroceryApps] = useState([]);

  useEffect(() => {
    groceryApi.getApps().then((r) => setGroceryApps(r.apps || [])).catch(() => {});
  }, []);

  return (
    <div className="integrations-page">
      <h1 className="page-title">Integrations</h1>
      <p className="page-subtitle">
        Connect your grocery delivery apps to streamline meal planning.
      </p>

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
