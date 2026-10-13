// Session : règles du jeu, joueur connecté, et liaison en direct avec les amis (Server-Sent Events).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState({ status: 'loading', me: null, stats: null, showcase: [], invite: null });
  const [online, setOnline] = useState([]);
  const [bootError, setBootError] = useState(null);
  const listeners = useRef(new Map());

  const emit = useCallback((event, data) => {
    for (const fn of listeners.current.get(event) ?? []) fn(data);
  }, []);
  const on = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const signedIn = useCallback((data) => {
    setState((s) => ({
      status: 'in',
      me: data.user,
      stats: data.stats,
      showcase: data.showcase ?? [],
      invite: data.invite ?? s.invite,
    }));
  }, []);
  const signedOut = useCallback(() => setState({ status: 'out', me: null, stats: null, showcase: [], invite: null }), []);

  useEffect(() => {
    setUnauthorizedHandler(signedOut);
    (async () => {
      try {
        setConfig(await api.config());
      } catch (e) {
        setBootError(e);
        return;
      }
      try {
        signedIn(await api.me());
      } catch {
        signedOut();
      }
    })();
  }, [signedIn, signedOut]);

  // Direct : on n'ouvre le flux qu'une fois connecté.
  useEffect(() => {
    if (state.status !== 'in') return undefined;
    const source = new EventSource('/api/live');
    source.addEventListener('feed', (e) => emit('feed', JSON.parse(e.data)));
    source.addEventListener('presence', (e) => setOnline(JSON.parse(e.data).online));
    return () => source.close();
  }, [state.status, emit]);

  const refresh = useCallback(async () => {
    try {
      signedIn(await api.me());
    } catch {
      /* déjà géré par le gestionnaire 401 */
    }
  }, [signedIn]);

  const value = useMemo(
    () => ({
      config,
      rules: config?.rules ?? null,
      ...state,
      online,
      bootError,
      on,
      signedIn,
      refresh,
      setStats: (stats) => setState((s) => ({ ...s, stats })),
      setShowcase: (showcase) => setState((s) => ({ ...s, showcase })),
      async logout() {
        try {
          await api.logout();
        } catch {
          /* on déconnecte quand même l'interface */
        }
        signedOut();
      },
    }),
    [config, state, online, bootError, on, signedIn, refresh, signedOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

// Abonnement à un événement du direct depuis un composant.
export function useLive(event, handler) {
  const { on } = useSession();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => on(event, (d) => ref.current(d)), [on, event]);
}
