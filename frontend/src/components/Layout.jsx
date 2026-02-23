import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import './Layout.css';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

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
        {user && (
          <div className="header-user">
            <span className="header-email" title={user.email}>{user.email}</span>
            <Button variant="ghost" className="header-logout" onClick={logout}>Sign out</Button>
          </div>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
