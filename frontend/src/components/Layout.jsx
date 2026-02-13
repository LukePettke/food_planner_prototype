import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">
          <span className="logo-icon">🍽</span>
          <span className="logo-text">Meal Planner</span>
        </Link>
        <nav className="nav">
          <Link to="/preferences" className={pathname === '/preferences' ? 'active' : ''}>Preferences</Link>
          <Link to="/plan" className={pathname.startsWith('/plan') ? 'active' : ''}>Plan</Link>
          <Link to="/integrations" className={pathname === '/integrations' ? 'active' : ''}>Integrations</Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
