// Bearer-token authentication backed by Supabase Auth.
const { anonClient, userClient } = require('./supabase');
const { HttpError, asyncHandler } = require('./http');

function bearerToken(req) {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token.trim() : null;
}

/**
 * Verifies the access token with Supabase Auth, then exposes:
 *   req.user  -> { id, email }
 *   req.db    -> Supabase client acting as that user (RLS enforced)
 */
const requireAuth = asyncHandler(async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, 'Authentication required');

    const { data, error } = await anonClient().auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, 'Invalid or expired session, please log in again');

    req.user = { id: data.user.id, email: data.user.email };
    req.accessToken = token;
    req.db = userClient(token);
    next();
});

module.exports = { requireAuth, bearerToken };
