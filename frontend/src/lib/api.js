// Thin fetch wrapper for the FinTrack REST API.
// Attaches the bearer token, refreshes once on 401, and normalises errors.

const BASE = '/api';
const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';
const EXPIRES_KEY = 'expiresAt';

export const SESSION_EVENT = 'fintrack:session';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken() {
  return read(TOKEN_KEY);
}

export function saveSession({ token, refreshToken, expiresAt }) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (expiresAt != null) localStorage.setItem(EXPIRES_KEY, String(expiresAt));
  } catch {
    /* storage unavailable: session lives only in memory for this page */
  }
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { token: token || null } }));
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch {
    /* nothing to clear */
  }
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { token: null } }));
}

export function toQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function messageFrom(body, status) {
  if (body && typeof body === 'object') {
    if (body.error && typeof body.error === 'object' && body.error.message) return body.error.message;
    if (typeof body.error === 'string') return body.error;
    if (body.message) return body.message;
  }
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  if (status === 0) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Try again.';
}

let refreshInFlight = null;

async function refreshSession() {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        const body = await parse(res);
        if (!res.ok || !body || !body.token) return false;
        saveSession(body);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

export async function api(path, { method = 'GET', body, signal, retried = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(messageFrom(null, 0), 0, null);
  }

  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    if (!retried && (await refreshSession())) {
      return api(path, { method, body, signal, retried: true });
    }
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.history.replaceState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    throw new ApiError('Your session has ended. Sign in again.', 401, null);
  }

  const data = await parse(res);
  if (!res.ok || (data && data.success === false)) {
    throw new ApiError(messageFrom(data, res.status), res.status, data);
  }
  return data;
}

export const get = (path, opts) => api(path, { ...opts, method: 'GET' });
export const post = (path, body) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

/** Some endpoints wrap results in { data }, budgets and goals return raw arrays. */
export function unwrap(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

export const idOf = (row) => (row ? row.id ?? row._id : undefined);
