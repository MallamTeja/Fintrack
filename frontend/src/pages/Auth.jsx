import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wordmark } from '../components/AppShell.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isEmail, isStrongPassword, passwordChecks } from '../lib/validate.js';
import './Auth.css';

function AuthLayout({ children }) {
  return (
    <div className="auth">
      <section className="auth__statement" aria-label="About FinTrack">
        <Wordmark />
        <div className="auth__copy">
          <p className="auth__headline">A ledger for the money that moves through your month.</p>
          <p className="auth__lede">
            Income, spending, budgets and savings goals on one ruled page, in the currency you choose.
          </p>
          <ol className="auth__list">
            <li>Record each entry once, with a category and a date.</li>
            <li>Set a monthly limit per category and see when one runs close.</li>
            <li>Put money aside for goals and track what is left to save.</li>
          </ol>
        </div>
      </section>
      <main className="auth__panel">
        <div className="auth__form-wrap">{children}</div>
      </main>
    </div>
  );
}

function FormError({ message }) {
  return (
    <p className="auth__error" role="alert">
      {message}
    </p>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!isEmail(form.email)) next.email = 'Enter the email you registered with.';
    if (!form.password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err.status === 401 ? 'That email and password do not match an account.' : err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Sign in</h1>
      <p className="auth__sub">Pick up where your ledger left off.</p>
      {formError && <FormError message={formError} />}
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          error={errors.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          error={errors.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth__switch">
        New to FinTrack? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const pwRef = useRef(null);
  const checks = passwordChecks(form.password);

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Tell us what to call you.';
    if (!isEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!isStrongPassword(form.password)) next.password = 'The password needs every item on the list.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      if (next.password && !next.name && !next.email) pwRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await register(form.name.trim(), form.email.trim(), form.password);
      if (res.needsEmailConfirmation) {
        setSentTo(form.email.trim());
        setBusy(false);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setFormError(err.status === 409 ? 'An account with this email already exists. Sign in instead.' : err.message);
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <h1 className="auth__title">Check your email</h1>
        <p className="auth__sub" role="status">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account, then sign in
          here.
        </p>
        <p className="auth__hint muted">Nothing after a few minutes? Look in spam, or register again with the right address.</p>
        <Link to="/login" className="btn btn--primary">
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="auth__title">Create your account</h1>
      <p className="auth__sub">It takes a minute. You can change your currency later.</p>
      {formError && <FormError message={formError} />}
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <Field
          id="name"
          label="Name"
          autoComplete="name"
          value={form.name}
          error={errors.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          error={errors.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          inputRef={pwRef}
          describedBy="pw-rules"
          maxLength={72}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        >
          <ul id="pw-rules" className="pwrules" aria-label="Password requirements">
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? 'is-met' : ''}>
                <Icon name={c.ok ? 'check' : 'dot'} size={16} />
                {c.label}
                <span className="visually-hidden">{c.ok ? ', done' : ', not yet'}</span>
              </li>
            ))}
          </ul>
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth__switch">
        Already keeping a ledger? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

function Field({ id, label, type = 'text', value, onChange, error, autoComplete, inputRef, describedBy, maxLength, children }) {
  const errId = `${id}-error`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[describedBy, errId].filter(Boolean).join(' ')}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
      <p id={errId} className="field__error">
        {error}
      </p>
    </div>
  );
}
