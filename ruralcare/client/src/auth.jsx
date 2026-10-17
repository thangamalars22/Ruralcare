import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((d) => setUser(d.user))
      // Only forget the token when the server says it is no longer valid. A network error or server restart should not log people out.
      .catch((e) => { if (e.status === 401 || e.status === 404) tokenStore.clear(); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('rc-unauthorized', logout);
    return () => window.removeEventListener('rc-unauthorized', logout);
  }, [logout]);

  const login = async (identifier, password, role) => {
    const d = await api.post('/auth/login', { identifier, password, role });
    tokenStore.set(d.token); setUser(d.user); return d.user;
  };
  const register = async (payload) => {
    const d = await api.post('/auth/register', payload);
    tokenStore.set(d.token); setUser(d.user); return d.user;
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}
