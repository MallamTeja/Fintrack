import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_EVENT, clearSession, get, getToken, post, put, saveSession } from '../lib/api.js';
import { normaliseCurrency, setDateFormat } from '../lib/format.js';
import { setRealtimeToken } from '../lib/realtime.js';

const AuthContext = createContext(null);

export const DEFAULT_PREFS = {
  theme: null,
  currency: 'INR',
  notifications: true,
  month_start_day: 1,
  date_format: 'DD/MM/YYYY',
  week_start: 'monday',
  monthly_income_target: null,
  budget_alerts: true,
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'anon'));

  useEffect(() => {
    const onSession = (e) => {
      const next = e.detail?.token ?? null;
      setToken(next);
      if (next) setRealtimeToken(next);
      else {
        setUser(null);
        setStatus('anon');
      }
    };
    window.addEventListener(SESSION_EVENT, onSession);
    return () => window.removeEventListener(SESSION_EVENT, onSession);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const body = await get('/auth/me');
      const me = body?.data || body?.user || null;
      if (!me) throw new Error('No profile');
      setUser({ ...me, preferences: { ...DEFAULT_PREFS, ...(me.preferences || {}) } });
      setStatus('authed');
    } catch {
      if (!getToken()) setStatus('anon');
      else setStatus('authed');
    }
  }, []);

  useEffect(() => {
    if (token && status === 'loading') loadMe();
  }, [token, status, loadMe]);

  const login = useCallback(async (email, password) => {
    const body = await post('/auth/login', { email, password });
    saveSession(body);
    setUser({ ...(body.user || {}), preferences: { ...DEFAULT_PREFS } });
    setStatus('loading');
    return body;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const body = await post('/auth/register', { name, email, password });
    if (body.needsEmailConfirmation || !body.token) return { ...body, needsEmailConfirmation: true };
    saveSession(body);
    setUser({ ...(body.user || {}), preferences: { ...DEFAULT_PREFS } });
    setStatus('loading');
    return body;
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
  }, []);

  /** Saves any subset of preferences, plus `name`, optimistically; rolls back on failure. */
  const updatePreferences = useCallback(
    async (patch) => {
      const prev = user;
      const { name, ...prefs } = patch;
      setUser((u) => (u ? { ...u, ...(name !== undefined ? { name } : {}), preferences: { ...u.preferences, ...prefs } } : u));
      try {
        const body = await put('/auth/preferences', patch);
        const serverPrefs = body?.preferences || body?.data?.preferences;
        const serverName = body?.name ?? body?.data?.name ?? body?.preferences?.name;
        setUser((u) => {
          if (!u) return u;
          const { name: _n, ...cleanPrefs } = serverPrefs || {};
          return {
            ...u,
            ...(typeof serverName === 'string' && serverName ? { name: serverName } : {}),
            preferences: { ...u.preferences, ...cleanPrefs },
          };
        });
      } catch (err) {
        setUser(prev);
        throw err;
      }
    },
    [user]
  );

  /** After the account is deleted there is nothing to sign out of on the server. */
  const endSession = useCallback(() => clearSession(), []);

  // Formatters are plain functions; keep their date format in step with the profile before children render.
  setDateFormat(user?.preferences?.date_format);

  const value = useMemo(
    () => ({
      status,
      token,
      user,
      currency: normaliseCurrency(user?.preferences?.currency),
      login,
      register,
      logout,
      updatePreferences,
      endSession,
    }),
    [status, token, user, login, register, logout, updatePreferences, endSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
