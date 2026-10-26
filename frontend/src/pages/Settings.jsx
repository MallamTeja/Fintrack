import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CharCount, LabelRow } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { changePassword, deleteAccount, exportCsv } from '../lib/data.js';
import { CURRENCIES, CURRENCY_NAMES, DATE_FORMATS, formatDate, formatMoney, isoDay } from '../lib/format.js';
import { focusFirstError, useForm } from '../lib/useForm.js';
import {
  LIMITS,
  MIN_DATE,
  isRealDay,
  parseAmount,
  passwordChecks,
  validateAmount,
  validateName,
} from '../lib/validate.js';
import './Settings.css';

function Status({ state }) {
  return (
    <p className={`form-status${state?.tone ? ` form-status--${state.tone}` : ''}`} role="status" aria-live="polite">
      {state?.text || ''}
    </p>
  );
}

function Section({ id, title, intro, children, tone }) {
  return (
    <section className={`setting${tone ? ` setting--${tone}` : ''}`} aria-labelledby={id}>
      <div className="setting__intro">
        <h2 id={id} className="section__title">
          {title}
        </h2>
        {intro && <p className="muted">{intro}</p>}
      </div>
      <div className="setting__body">{children}</div>
    </section>
  );
}

const errorProps = (errors, k, id, extra = []) => ({
  'aria-invalid': errors[k] ? 'true' : undefined,
  'aria-describedby': [`${id}-err`, ...extra].join(' '),
});

/* Profile */
function ProfileForm() {
  const { user, updatePreferences } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const form = useForm({ name: user?.name || '' }, (v) => {
    const e = validateName(v.name);
    return e ? { name: e } : {};
  });
  const { errors, values } = form;

  async function submit(e) {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    const name = values.name.trim();
    if (name === (user?.name || '')) {
      setStatus({ tone: '', text: 'No changes to save.' });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await updatePreferences({ name });
      setStatus({ tone: 'ok', text: 'Profile saved.' });
    } catch (err) {
      if (err.status === 400) form.setServerErrors({ name: err.message });
      setStatus({ tone: 'error', text: `Profile not saved: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} className="setform" onSubmit={submit} noValidate>
      <div className="field">
        <LabelRow htmlFor="pf-name" count={<CharCount id="pf-name-count" value={values.name} max={LIMITS.name} />}>
          Name
        </LabelRow>
        <input
          id="pf-name"
          className="input"
          autoComplete="name"
          maxLength={LIMITS.name}
          {...form.bind('name', { describedBy: ['pf-name-err', 'pf-name-count'] })}
        />
        <p id="pf-name-err" className="field__error">
          {errors.name}
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pf-email">
          Email
        </label>
        <input id="pf-email" className="input" type="email" value={user?.email || ''} readOnly aria-describedby="pf-email-hint" />
        <p id="pf-email-hint" className="field__hint">
          The address you sign in with. It cannot be changed here.
        </p>
      </div>
      <div className="setform__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        <Status state={status} />
      </div>
    </form>
  );
}

/* Preferences */
const DATE_FORMAT_LABELS = { 'DD/MM/YYYY': 'Day first', 'MM/DD/YYYY': 'Month first', 'YYYY-MM-DD': 'Year first (ISO)' };

function validatePrefs(v) {
  const errors = {};
  const d = Number(v.month_start_day);
  if (!/^\d+$/.test(String(v.month_start_day)) || d < 1 || d > 28) errors.month_start_day = 'Choose a day from 1 to 28.';
  if (String(v.monthly_income_target).trim() !== '') {
    const t = validateAmount(v.monthly_income_target, { label: 'Income target' });
    if (t) errors.monthly_income_target = t;
  }
  return errors;
}

function PreferencesForm() {
  const { user, updatePreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const p = user?.preferences || {};
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const form = useForm(
    {
      currency: CURRENCIES.includes(p.currency) ? p.currency : 'INR',
      date_format: DATE_FORMATS.includes(p.date_format) ? p.date_format : 'DD/MM/YYYY',
      week_start: p.week_start === 'sunday' ? 'sunday' : 'monday',
      month_start_day: String(p.month_start_day || 1),
      monthly_income_target: p.monthly_income_target == null ? '' : String(p.monthly_income_target),
      theme,
    },
    validatePrefs
  );
  const { values, errors, setValue } = form;
  const sample = isoDay(new Date());

  async function submit(e) {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    const patch = {
      currency: values.currency,
      date_format: values.date_format,
      week_start: values.week_start,
      month_start_day: Number(values.month_start_day),
      monthly_income_target: String(values.monthly_income_target).trim() === '' ? null : parseAmount(values.monthly_income_target),
      theme: values.theme,
    };
    setBusy(true);
    setStatus(null);
    const prevTheme = theme;
    setTheme(values.theme);
    try {
      await updatePreferences(patch);
      setStatus({ tone: 'ok', text: 'Preferences saved.' });
    } catch (err) {
      setTheme(prevTheme);
      setStatus({ tone: 'error', text: `Preferences not saved: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} className="setform" onSubmit={submit} noValidate>
      <div className="setform__pair">
        <div className="field">
          <label className="field__label" htmlFor="pr-currency">
            Currency
          </label>
          <select id="pr-currency" className="input" {...form.bind('currency', { describedBy: ['pr-currency-hint'] })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}, {CURRENCY_NAMES[c]}
              </option>
            ))}
          </select>
          <p id="pr-currency-hint" className="field__hint num">
            Shown as {formatMoney(123456.5, values.currency)}.
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pr-datefmt">
            Date format
          </label>
          <select id="pr-datefmt" className="input" {...form.bind('date_format', { describedBy: ['pr-datefmt-hint'] })}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}, {DATE_FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
          <p id="pr-datefmt-hint" className="field__hint num">
            Today is {formatDate(sample, values.date_format)}.
          </p>
        </div>
      </div>

      <div className="setform__pair">
        <div className="field">
          <label className="field__label" htmlFor="pr-msd">
            Month starts on day
          </label>
          <input
            id="pr-msd"
            className="input num"
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            step={1}
            {...form.bind('month_start_day', { describedBy: ['pr-msd-err', 'pr-msd-hint'] })}
          />
          <p id="pr-msd-hint" className="field__hint">
            For a pay cycle that starts mid-month, 1 to 28.
          </p>
          <p id="pr-msd-err" className="field__error">
            {errors.month_start_day}
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pr-target">
            Monthly income target (optional)
          </label>
          <input
            id="pr-target"
            className="input input--money"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            maxLength={LIMITS.amountChars}
            {...form.bind('monthly_income_target', { describedBy: ['pr-target-err'] })}
          />
          <p id="pr-target-err" className="field__error">
            {errors.monthly_income_target}
          </p>
        </div>
      </div>

      <div className="setform__pair">
        <fieldset className="setform__fieldset">
          <legend className="field__label">Week starts on</legend>
          <div className="seg">
            {[
              ['monday', 'Monday'],
              ['sunday', 'Sunday'],
            ].map(([v, label]) => (
              <label key={v} className="seg__opt">
                <input type="radio" name="week_start" value={v} checked={values.week_start === v} onChange={() => setValue('week_start', v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="setform__fieldset">
          <legend className="field__label">Theme</legend>
          <div className="seg">
            {[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ].map(([v, label]) => (
              <label key={v} className="seg__opt">
                <input type="radio" name="theme" value={v} checked={values.theme === v} onChange={() => setValue('theme', v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="setform__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
        <Status state={status} />
      </div>
    </form>
  );
}

/* Notifications: each switch saves on its own */
function NotificationSwitches() {
  const { user, updatePreferences } = useAuth();
  const p = user?.preferences || {};
  const [saving, setSaving] = useState('');
  const [status, setStatus] = useState(null);

  async function toggle(key, value, label) {
    setSaving(key);
    setStatus(null);
    try {
      await updatePreferences({ [key]: value });
      setStatus({ tone: 'ok', text: `${label} turned ${value ? 'on' : 'off'}.` });
    } catch (err) {
      setStatus({ tone: 'error', text: `${label} not changed: ${err.message}` });
    } finally {
      setSaving('');
    }
  }

  const item = (key, label, hint) => {
    const on = p[key] !== false;
    return (
      <div className="switch-row">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={saving === key}
            onChange={(e) => toggle(key, e.target.checked, label)}
            aria-describedby={`${key}-hint`}
          />
          <span className="switch__track" aria-hidden="true" />
          <span className="switch__label">{label}</span>
        </label>
        <p id={`${key}-hint`} className="field__hint">
          {hint}
        </p>
      </div>
    );
  };

  return (
    <div className="setform">
      {item('budget_alerts', 'Budget alerts', 'A notice when a category reaches 80% of its monthly limit, and again when it goes over.')}
      {item('notifications', 'Account notices', 'Messages about your account, such as sign-ins and changes to your data.')}
      <Status state={status} />
    </div>
  );
}

/* Security */
function PasswordForm() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const form = useForm({ current: '', next: '', confirm: '' }, (v) => {
    const e = {};
    if (!v.current) e.current = 'Enter your current password.';
    if (!passwordChecks(v.next).every((c) => c.ok)) e.next = 'The new password needs every item on the list.';
    else if (v.next === v.current) e.next = 'Choose a password different from the current one.';
    if (!v.confirm) e.confirm = 'Type the new password again.';
    else if (v.confirm !== v.next) e.confirm = 'This does not match the new password.';
    return e;
  });
  const { values, errors } = form;
  const checks = passwordChecks(values.next);

  async function submit(e) {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await changePassword(values.current, values.next);
      form.reset({ current: '', next: '', confirm: '' });
      setStatus({ tone: 'ok', text: 'Password changed. Use the new one next time you sign in.' });
    } catch (err) {
      if (err.status === 401) {
        form.setServerErrors({ current: 'That is not your current password.' });
        ref.current?.querySelector('[name="current"]')?.focus();
      } else if (err.status === 400) {
        form.setServerErrors({ next: err.message });
      } else setStatus({ tone: 'error', text: `Password not changed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} className="setform" onSubmit={submit} noValidate aria-label="Change password">
      <div className="field">
        <label className="field__label" htmlFor="pw-current">
          Current password
        </label>
        <input
          id="pw-current"
          className="input"
          type="password"
          autoComplete="current-password"
          maxLength={LIMITS.passwordMax}
          {...form.bind('current', { describedBy: ['pw-current-err'] })}
        />
        <p id="pw-current-err" className="field__error">
          {errors.current}
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pw-next">
          New password
        </label>
        <input
          id="pw-next"
          className="input"
          type="password"
          autoComplete="new-password"
          maxLength={LIMITS.passwordMax}
          {...form.bind('next', { describedBy: ['pw-next-err', 'pw-rules'] })}
        />
        <ul id="pw-rules" className="pwrules" aria-label="Password requirements">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? 'is-met' : undefined}>
              <Icon name={c.ok ? 'check' : 'dot'} size={16} />
              {c.label}
              <span className="visually-hidden">{c.ok ? ', done' : ', not yet'}</span>
            </li>
          ))}
        </ul>
        <p id="pw-next-err" className="field__error">
          {errors.next}
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pw-confirm">
          Confirm new password
        </label>
        <input
          id="pw-confirm"
          className="input"
          type="password"
          autoComplete="new-password"
          maxLength={LIMITS.passwordMax}
          {...form.bind('confirm', { describedBy: ['pw-confirm-err'] })}
        />
        <p id="pw-confirm-err" className="field__error">
          {errors.confirm}
        </p>
      </div>
      <div className="setform__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
        <Status state={status} />
      </div>
    </form>
  );
}

/* Data */
function ExportForm() {
  const today = isoDay(new Date());
  const [range, setRange] = useState({ from: `${today.slice(0, 4)}-01-01`, to: today });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = (r) => {
    const e = {};
    if (r.from && (!isRealDay(r.from) || r.from < MIN_DATE)) e.from = 'Use a valid start date.';
    if (r.to && !isRealDay(r.to)) e.to = 'Use a valid end date.';
    if (!e.from && !e.to && r.from && r.to && r.from > r.to) e.to = 'The end date must be on or after the start date.';
    return e;
  };
  const set = (k) => (ev) => {
    const next = { ...range, [k]: ev.target.value };
    setRange(next);
    if (Object.keys(errors).length) setErrors(check(next));
  };

  async function submit(e) {
    e.preventDefault();
    const errs = check(range);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setStatus(null);
    try {
      const name = await exportCsv({ startDate: range.from || undefined, endDate: range.to || undefined });
      setStatus({ tone: 'ok', text: `Saved ${name}.` });
    } catch (err) {
      setStatus({ tone: 'error', text: `Export failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="setform" onSubmit={submit} noValidate aria-label="Export transactions">
      <div className="setform__pair">
        <div className="field">
          <label className="field__label" htmlFor="ex-from">
            From
          </label>
          <input id="ex-from" className="input" type="date" min={MIN_DATE} max={range.to || today} value={range.from} onChange={set('from')} onBlur={() => setErrors(check(range))} {...errorProps(errors, 'from', 'ex-from')} />
          <p id="ex-from-err" className="field__error">
            {errors.from}
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ex-to">
            To
          </label>
          <input id="ex-to" className="input" type="date" min={range.from || MIN_DATE} value={range.to} onChange={set('to')} onBlur={() => setErrors(check(range))} {...errorProps(errors, 'to', 'ex-to')} />
          <p id="ex-to-err" className="field__error">
            {errors.to}
          </p>
        </div>
      </div>
      <div className="setform__actions">
        <button type="submit" className="btn" disabled={busy}>
          <Icon name="export" size={18} />
          {busy ? 'Exporting…' : 'Export CSV'}
        </button>
        <Link to="/import" className="btn btn--quiet">
          <Icon name="import" size={18} />
          Import a statement
        </Link>
      </div>
      <Status state={status} />
    </form>
  );
}

/* Danger zone */
function DeleteAccount() {
  const { endSession } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm(e) {
    e.preventDefault();
    if (typed.trim() !== 'DELETE') {
      setError('Type DELETE in capital letters to confirm.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      setOpen(false);
      endSession();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(`The account was not deleted: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--danger"
        onClick={() => {
          setTyped('');
          setError('');
          setOpen(true);
        }}
      >
        Delete account
      </button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        variant="dialog"
        title="Delete your account?"
        description="Every transaction, budget and savings goal is removed for good, then you are signed out. This cannot be undone."
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </button>
            <button type="submit" form="delete-form" className="btn btn--danger" disabled={busy}>
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </>
        }
      >
        <form id="delete-form" onSubmit={confirm} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="del-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="del-confirm"
              className="input"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (e.target.value.trim() === 'DELETE') setError('');
              }}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby="del-confirm-err"
              data-autofocus
            />
            <p id="del-confirm-err" className="field__error" role="alert">
              {error}
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  return (
    <div className="page settings">
      <header className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__lede">Each section saves on its own.</p>
        </div>
      </header>

      <Section id="s-profile" title="Profile" intro="How FinTrack addresses you.">
        <ProfileForm />
      </Section>

      <Section id="s-prefs" title="Preferences" intro="Currency and date format apply across every page. Stored amounts are not converted.">
        <PreferencesForm />
      </Section>

      <Section id="s-notify" title="Notifications" intro="Switches save as soon as you change them.">
        <NotificationSwitches />
      </Section>

      <Section id="s-security" title="Security" intro="Change your password, or sign out of FinTrack on this device.">
        <PasswordForm />
        <div className="setform__signout">
          <button type="button" className="btn btn--quiet" onClick={logout}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      </Section>

      <Section id="s-data" title="Data" intro="Download your ledger as CSV for a date range, or bring in a bank or UPI statement.">
        <ExportForm />
      </Section>

      <Section id="s-danger" title="Danger zone" intro="Deleting your account removes all of your data from FinTrack." tone="danger">
        <DeleteAccount />
      </Section>
    </div>
  );
}
