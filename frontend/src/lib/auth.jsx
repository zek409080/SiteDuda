import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | out | in
  const [settings, setSettings] = useState(null);

  // Ao abrir o site, pergunta a API se o cookie de sessao ainda vale.
  useEffect(() => {
    let active = true;
    api
      .session()
      .then((data) => {
        if (!active) return;
        setSettings(data.settings);
        setStatus('in');
      })
      .catch(() => active && setStatus('out'));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (pin) => {
    const data = await api.login(pin);
    setSettings(data.settings);
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setSettings(null);
    setStatus('out');
  }, []);

  const value = useMemo(
    () => ({ status, settings, setSettings, login, logout }),
    [status, settings, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
