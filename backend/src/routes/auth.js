// /api/auth: thin wrapper over Supabase Auth so the existing pages keep working.
const express = require('express');
const { anonClient, isolatedClient } = require('../supabase');
const { config } = require('../config');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { parseCredentials, parsePreferences, parsePasswordChange, PREFERENCE_FIELDS } = require('../validate');

const router = express.Router();

const sessionBody = (session) =>
    session
        ? { token: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at }
        : { token: null, refreshToken: null, expiresAt: null };

const PROFILE_COLUMNS = ['name', ...PREFERENCE_FIELDS].join(', ');

const preferencesOf = (profile) => {
    const out = {};
    for (const k of PREFERENCE_FIELDS) out[k] = profile[k];
    out.monthly_income_target = profile.monthly_income_target === null ? null : Number(profile.monthly_income_target);
    return out;
};

const publicUser = (user, profile) => ({
    id: user.id,
    email: user.email,
    name: profile?.name ?? user.user_metadata?.name ?? '',
    preferences: profile ? preferencesOf(profile) : undefined,
});

/** Calls a Supabase Auth endpoint with a user's access token. */
const authFetch = (path, method, accessToken, body) =>
    fetch(`${config.supabaseUrl}/auth/v1${path}`, {
        method,
        headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name } = parseCredentials(req.body, { withName: true });
    const { data, error } = await anonClient().auth.signUp({ email, password, options: { data: { name } } });
    if (error) {
        if (error.status === 422 || /already/i.test(error.message)) throw new HttpError(409, 'An account with this email already exists');
        if (error.status === 429) throw new HttpError(429, 'Too many sign-up attempts, please try again later');
        throw new HttpError(400, 'Could not create the account');
    }
    // With email confirmation enabled Supabase returns no session and an empty identities list for existing emails.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new HttpError(409, 'An account with this email already exists');
    }
    res.status(201).json({
        success: true,
        ...sessionBody(data.session),
        needsEmailConfirmation: !data.session,
        user: publicUser(data.user),
    });
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = parseCredentials(req.body);
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
        if (error?.status === 429) throw new HttpError(429, 'Too many login attempts, please try again later');
        if (error?.code === 'email_not_confirmed') throw new HttpError(403, 'Please confirm your email first');
        throw new HttpError(401, 'Invalid email or password');
    }
    res.json({ success: true, ...sessionBody(data.session), user: publicUser(data.user) });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken) throw new HttpError(400, 'refreshToken is required');
    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw new HttpError(401, 'Session expired, please log in again');
    res.json({ success: true, ...sessionBody(data.session) });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
    // Revoke this session's refresh token on the Supabase side.
    await authFetch('/logout?scope=local', 'POST', req.accessToken).catch(() => {});
    res.json({ success: true, message: 'Logged out' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const { data: profile, error } = await req.db.from('profiles').select(PROFILE_COLUMNS).eq('id', req.user.id).maybeSingle();
    if (error) throw fromDbError(error);
    res.json({ success: true, data: publicUser({ id: req.user.id, email: req.user.email }, profile) });
}));

router.put('/preferences', requireAuth, asyncHandler(async (req, res) => {
    const prefs = parsePreferences(req.body);
    const { data, error } = await req.db
        .from('profiles')
        .update(prefs)
        .eq('id', req.user.id)
        .select(PROFILE_COLUMNS)
        .single();
    if (error) throw fromDbError(error, 'Profile not found');
    const user = publicUser({ id: req.user.id, email: req.user.email }, data);
    res.json({ success: true, preferences: user.preferences, user });
}));

router.post('/password', requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parsePasswordChange(req.body);

    // Prove knowledge of the current password with a fresh, unshared client.
    const { data, error } = await isolatedClient().auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword,
    });
    if (error || !data.session) {
        if (error?.status === 429) throw new HttpError(429, 'Too many attempts, please try again later');
        throw new HttpError(401, 'Current password is incorrect');
    }
    if (data.user.id !== req.user.id) throw new HttpError(401, 'Current password is incorrect');

    // End the session the check just created, then update with the caller's own token:
    // Supabase signs out every other session of the user on a password change, keeping this one.
    await authFetch('/logout?scope=local', 'POST', data.session.access_token).catch(() => {});
    const upd = await authFetch('/user', 'PUT', req.accessToken, { password: newPassword });
    const body = await upd.json().catch(() => ({}));
    if (!upd.ok) {
        const code = body.error_code || body.code;
        if (upd.status === 429) throw new HttpError(429, 'Too many attempts, please try again later');
        if (code === 'same_password') throw new HttpError(400, 'New password must be different from the current one');
        if (code === 'weak_password') throw new HttpError(400, 'New password is too weak');
        if (upd.status >= 400 && upd.status < 500) throw new HttpError(400, 'Could not update the password');
        throw new HttpError(500, 'Auth service error');
    }
    res.json({ success: true, message: 'Password updated' });
}));

router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
    if (req.body?.confirm !== 'DELETE') {
        throw new HttpError(400, 'To delete your account send { "confirm": "DELETE" }');
    }
    // SECURITY DEFINER function that deletes only auth.uid(); cascades remove every row the user owns.
    const { error } = await req.db.rpc('delete_my_account');
    if (error) throw fromDbError(error);
    res.json({ success: true, message: 'Account deleted' });
}));

module.exports = router;
