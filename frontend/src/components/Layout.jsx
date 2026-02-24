import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import './Layout.css';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, logout, updateProfile } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBirthday(user.birthday ?? '');
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ firstName, lastName, birthday });
      setProfileOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = user
    ? [user.firstName?.trim(), user.lastName?.trim()]
        .filter(Boolean)
        .map((s) => s[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || user.email?.[0]?.toUpperCase() || '?'
    : '';

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">
          <img src="/mealflow-logo.png" alt="MealFlow" className="logo-img" />
          <span className="logo-text">MealFlow</span>
        </Link>
        <nav className="nav">
          <Link to="/preferences" className={pathname === '/preferences' ? 'active' : ''}>Preferences</Link>
          <Link to="/plan" className={pathname.startsWith('/plan') ? 'active' : ''}>Meal Plan</Link>
          <Link to="/integrations" className={pathname === '/integrations' ? 'active' : ''}>Integrations</Link>
        </nav>
        {user && (
          <div className="header-profile-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="header-profile-trigger"
              onClick={(e) => { e.stopPropagation(); setProfileOpen((o) => !o); }}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              title="Profile"
            >
              <span className="header-profile-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="header-email">{user.email}</span>
            </button>
            {profileOpen && (
              <div className="header-profile-dropdown">
                <form onSubmit={handleSaveProfile} className="header-profile-form">
                  <label className="header-profile-label">
                    First name
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="header-profile-input"
                    />
                  </label>
                  <label className="header-profile-label">
                    Last name
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="header-profile-input"
                    />
                  </label>
                  <label className="header-profile-label">
                    Birthday
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="header-profile-input"
                    />
                  </label>
                  <div className="header-profile-actions">
                    <Button type="submit" variant="primary" disabled={saving} className="header-profile-save">
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </form>
                <div className="header-profile-footer">
                  <Button variant="ghost" className="header-logout" onClick={() => { logout(); setProfileOpen(false); }}>
                    Sign out
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
