import { useCallback, useEffect, useRef, useState } from 'react';

// A tiny shared invalidation bus. Any component can call invalidate('transactions')
// and every mounted resource tagged with that key refetches quietly.
const listeners = new Map();

export function invalidate(...keys) {
  keys.forEach((k) => (listeners.get(k) || new Set()).forEach((fn) => fn()));
}

function subscribe(keys, fn) {
  keys.forEach((k) => {
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k).add(fn);
  });
  return () => keys.forEach((k) => listeners.get(k)?.delete(fn));
}

/**
 * useResource(fetcher, { keys, deps })
 * fetcher: (signal) => Promise<data>. Refetches when deps change or a key is invalidated.
 * Returns { data, error, loading, refetch, setData } where setData enables optimistic edits.
 */
export function useResource(fetcher, { keys = [], deps = [] } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const ctrlRef = useRef(null);

  const run = useCallback(async ({ quiet = false } = {}) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current(ctrl.signal);
      if (!ctrl.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (ctrl.signal.aborted || error?.name === 'AbortError') return;
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    run();
    return () => ctrlRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const keyList = keys.join('|');
  useEffect(() => {
    if (!keyList) return undefined;
    return subscribe(keyList.split('|'), () => run({ quiet: true }));
  }, [keyList, run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, refetch: run, setData };
}
