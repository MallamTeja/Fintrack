// Live updates via Supabase Realtime. Optional: if config or the socket fails, the app
// keeps working on plain REST and the indicator simply stays off.
import { invalidate } from './useResource.js';

const TABLES = {
  transactions: ['transactions'],
  budgets: ['budgets'],
  savings_goals: ['savings'],
};

let configPromise = null;
let client = null;
let channel = null;

function loadConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/config', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => (c && c.supabaseUrl && c.supabaseAnonKey ? c : null))
      .catch(() => null);
  }
  return configPromise;
}

/**
 * startRealtime(token, onStatus) subscribes to the user's rows and returns a stop function.
 * onStatus receives 'connecting' | 'live' | 'off'.
 */
export function startRealtime(token, onStatus = () => {}) {
  let stopped = false;
  onStatus('connecting');

  (async () => {
    try {
      const cfg = await loadConfig();
      if (!cfg || stopped) return onStatus('off');
      const { createClient } = await import('@supabase/supabase-js');
      if (stopped) return undefined;
      if (!client) {
        client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
      }
      client.realtime.setAuth(token);
      channel = client.channel('fintrack-user-changes');
      Object.entries(TABLES).forEach(([table, keys]) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => invalidate(...keys, 'summary'));
      });
      channel.subscribe((status) => {
        if (stopped) return;
        if (status === 'SUBSCRIBED') onStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('off');
      });
    } catch {
      if (!stopped) onStatus('off');
    }
    return undefined;
  })();

  return () => {
    stopped = true;
    if (client && channel) {
      client.removeChannel(channel).catch(() => {});
      channel = null;
    }
  };
}

/** Call after a token refresh so the socket keeps passing RLS. */
export function setRealtimeToken(token) {
  try {
    if (client && token) client.realtime.setAuth(token);
  } catch {
    /* realtime is best effort */
  }
}
