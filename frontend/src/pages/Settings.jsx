import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { CURRENCIES, formatMoney } from '../lib/format.js';
import './Settings.css';

const CURRENCY_NAMES = { INR: 'Indian rupee', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound' };

export default function Settings() {
  const { user, currency, updatePreferences, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState('');
  const [status, setStatus] = useState({ tone: '', text: '' });
  const notifications = user?.preferences?.notifications !== false;

  async function save(key, value, label) {
    setSaving(key);
    setStatus({ tone: '', text: '' });
    try {
      await updatePreferences({ [key]: value });
      setStatus({ tone: 'ok', text: `${label} saved.` });
    } catch (err) {
      setStatus({ tone: 'error', text: `${label} not saved: ${err.message}` });
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="page settings">
      <header className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__lede">Changes save as you make them.</p>
        </div>
      </header>

      <p className={`settings__status settings__status--${status.tone}`} role="status" aria-live="polite">
        {status.text}
      </p>

      <section className="setting" aria-labelledby="s-profile">
        <div className="setting__intro">
          <h2 id="s-profile" className="section__title">
            Profile
          </h2>
        </div>
        <dl className="setting__body profile">
          <div>
            <dt>Name</dt>
            <dd>{user?.name || 'Not set'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || 'Not available'}</dd>
          </div>
        </dl>
      </section>

      <section className="setting" aria-labelledby="s-theme">
        <div className="setting__intro">
          <h2 id="s-theme" className="section__title">
            Appearance
          </h2>
          <p className="muted">Paper by day, lamplight by night. Stored on this device and in your account.</p>
        </div>
        <fieldset className="setting__body setting__fieldset">
          <legend className="visually-hidden">Theme</legend>
          <div className="seg">
            {[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ].map(([v, label]) => (
              <label key={v} className="seg__opt">
                <input
                  type="radio"
                  name="theme"
                  value={v}
                  checked={theme === v}
                  disabled={saving === 'theme'}
                  onChange={() => {
                    setTheme(v);
                    save('theme', v, 'Theme');
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="setting" aria-labelledby="s-currency">
        <div className="setting__intro">
          <h2 id="s-currency" className="section__title">
            Currency
          </h2>
          <p className="muted">How amounts are shown. Stored figures are not converted.</p>
        </div>
        <div className="setting__body field">
          <label className="field__label" htmlFor="currency">
            Display currency
          </label>
          <select
            id="currency"
            className="input"
            value={currency}
            disabled={saving === 'currency'}
            onChange={(e) => save('currency', e.target.value, 'Currency')}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}, {CURRENCY_NAMES[c]}
              </option>
            ))}
          </select>
          <p className="field__hint num">Example: {formatMoney(123456.5, currency)}</p>
        </div>
      </section>

      <section className="setting" aria-labelledby="s-notify">
        <div className="setting__intro">
          <h2 id="s-notify" className="section__title">
            Notifications
          </h2>
          <p className="muted">Whether FinTrack may send you notices about your account.</p>
        </div>
        <div className="setting__body">
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={notifications}
              disabled={saving === 'notifications'}
              onChange={(e) => save('notifications', e.target.checked, 'Notifications')}
            />
            <span className="switch__track" aria-hidden="true" />
            <span className="switch__label">{notifications ? 'On' : 'Off'}</span>
          </label>
        </div>
      </section>

      <section className="setting" aria-labelledby="s-session">
        <div className="setting__intro">
          <h2 id="s-session" className="section__title">
            Session
          </h2>
          <p className="muted">Sign out of FinTrack on this device.</p>
        </div>
        <div className="setting__body">
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
