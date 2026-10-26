// Shared API glue for every page. Load it first, before any other script.
//  - adds the stored Supabase access token to every /api request
//  - on a 401, refreshes the session once and retries; otherwise sends the user to login
//  - window.unwrapApi(body) accepts both raw arrays and { success, data } envelopes
(function () {
    const nativeFetch = window.fetch.bind(window);
    const isApi = (url) => {
        try {
            const u = new URL(typeof url === 'string' ? url : url.url, window.location.origin);
            return u.origin === window.location.origin && u.pathname.startsWith('/api/');
        } catch {
            return false;
        }
    };
    const isAuthCall = (url) => /\/api\/auth\/(login|register|refresh)\b/.test(typeof url === 'string' ? url : url.url);

    function withToken(init) {
        const token = localStorage.getItem('token');
        const headers = new Headers((init && init.headers) || {});
        if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return { ...(init || {}), headers };
    }

    let refreshing = null;
    async function refreshSession() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        refreshing =
            refreshing ||
            nativeFetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            })
                .then(async (res) => {
                    if (!res.ok) return false;
                    const data = await res.json();
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    return true;
                })
                .catch(() => false)
                .finally(() => setTimeout(() => (refreshing = null), 0));
        return refreshing;
    }

    function logoutToLogin() {
        ['token', 'refreshToken', 'user', 'userData'].forEach((k) => localStorage.removeItem(k));
        if (!/\/(login|register)\.html$/.test(window.location.pathname)) window.location.href = '/login.html';
    }

    window.fetch = async function (input, init) {
        if (!isApi(input) || isAuthCall(input)) return nativeFetch(input, init);
        let res = await nativeFetch(input, withToken(init));
        if (res.status === 401) {
            if (await refreshSession()) {
                res = await nativeFetch(input, withToken({ ...(init || {}), headers: stripAuth((init && init.headers) || {}) }));
            }
            if (res.status === 401) logoutToLogin();
        }
        return res;
    };

    function stripAuth(headers) {
        const h = new Headers(headers);
        h.delete('Authorization');
        return h;
    }

    window.unwrapApi = (body) => (Array.isArray(body) ? body : body && body.data !== undefined ? body.data : body);
    window.apiErrorMessage = (body, fallback) =>
        (body && body.error && (body.error.message || body.error)) || fallback || 'Something went wrong';
    window.fintrackLogout = async () => {
        try {
            await window.fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            logoutToLogin();
        }
    };
})();
