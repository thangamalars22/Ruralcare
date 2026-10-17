import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Loads `path`. Keeps showing the previous data while refreshing (no flicker).
//   poll: milliseconds between automatic background refreshes (0 = off). Also refreshes when the tab becomes visible again,
//   so a change made by the other account (a doctor rescheduling, a patient cancelling...) shows up without a manual reload.
export function useApi(path, { poll = 0 } = {}) {
  const [state, set] = useState({ data: null, loading: !!path, error: null, path: null });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!path) { set({ data: null, loading: false, error: null, path: null }); return undefined; }
    let on = true;
    set((s) => (s.path === path ? { ...s, error: null } : { data: null, loading: true, error: null, path }));
    api.get(path)
      .then((data) => on && set({ data, loading: false, error: null, path }))
      .catch((error) => on && set((s) => (s.path === path && s.data ? { ...s, loading: false } : { data: null, loading: false, error, path })));
    return () => { on = false; };
  }, [path, n]);

  useEffect(() => {
    if (!poll || !path) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') setN((x) => x + 1); };
    const t = setInterval(tick, poll);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [poll, path]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, reload };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
