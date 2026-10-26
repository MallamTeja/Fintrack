import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_EVENT, clearSession, get, getToken, post, put, saveSession } from '../lib/api.js';
import { normaliseCurrency } from '../lib/format.js';
import { setRealtimeToken } from '../lib/realtime.js';

const AuthContext = createContext(null);

const DEFAULT_PREFS = { theme: null, currency: 'INR', notifications: true };

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

  const updatePreferences = useCallback(
    async (patch) => {
      const prev = user?.preferences;
      setUser((u) => (u ? { ...u, preferences: { ...u.preferences, ...patch } } : u));
      try {
        const body = await put('/auth/preferences', patch);
        if (body?.preferences) {
          setUser((u) => (u ? { ...u, preferences: { ...u.preferences, ...body.preferences } } : u));
        }
      } catch (err) {
        setUser((u) => (u ? { ...u, preferences: prev } : u));
        throw err;
      }
    },
    [user]
  );

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
    }),
    [status, token, user, login, register, logout, updatePreferences]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
