const { createClient } = require('@supabase/supabase-js');
const { config, assertConfig } = require('./config');

const clientOptions = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

let anon = null;

/** Shared client without a user session: used for sign-up, sign-in and token checks. */
function anonClient() {
    if (!anon) {
        assertConfig();
        anon = createClient(config.supabaseUrl, config.supabaseAnonKey, clientOptions);
    }
    return anon;
}

/**
 * Client that acts as the signed-in user. Every query it makes goes through
 * Postgres Row Level Security, so a user can only ever touch their own rows.
 */
function userClient(accessToken) {
    assertConfig();
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        ...clientOptions,
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}

module.exports = { anonClient, userClient };
