// Runtime configuration. Everything comes from environment variables;
// nothing secret is ever stored in the repository.

// Load backend/.env for local development (Node >= 20.12). Absent file is fine.
try {
    process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
} catch {
    /* no .env file: rely on the real environment */
}

const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    // The publishable/anon key is safe to use server-side with RLS; we never need the service role key.
    supabaseAnonKey:
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        '',
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowedOrigins: (process.env.FRONTEND_URL || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
};

function assertConfig() {
    const missing = [];
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)');
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

module.exports = { config, assertConfig };
