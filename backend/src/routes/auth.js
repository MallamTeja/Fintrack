// /api/auth: thin wrapper over Supabase Auth so the existing pages keep working.
const express = require('express');
const { anonClient } = require('../supabase');
const { config } = require('../config');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { parseCredentials, parsePreferences } = require('../validate');

const router = express.Router();

const sessionBody = (session) =>
    session
        ? { token: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at }
        : { token: null, refreshToken: null, expiresAt: null };

const publicUser = (user, profile) => ({
    id: user.id,
    email: user.email,
    name: profile?.name ?? user.user_metadata?.name ?? '',
    preferences: profile
        ? { theme: profile.theme, currency: profile.currency, notifications: profile.notifications }
        : undefined,
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
    await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
        method: 'POST',
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${req.accessToken}` },
    }).catch(() => {});
    res.json({ success: true, message: 'Logged out' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const { data: profile, error } = await req.db.from('profiles').select('*').eq('id', req.user.id).maybeSingle();
    if (error) throw fromDbError(error);
    res.json({ success: true, data: publicUser({ id: req.user.id, email: req.user.email }, profile) });
}));

router.put('/preferences', requireAuth, asyncHandler(async (req, res) => {
    const prefs = parsePreferences(req.body);
    const { data, error } = await req.db
        .from('profiles')
        .update(prefs)
        .eq('id', req.user.id)
        .select('theme, currency, notifications')
        .single();
    if (error) throw fromDbError(error, 'Profile not found');
    res.json({ success: true, preferences: data });
}));

module.exports = router;
