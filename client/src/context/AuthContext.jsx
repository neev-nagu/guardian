import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('papaya_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('papaya_token');
    if (!token) { setLoading(false); return; }
    api.getMe()
      .then(u => { setUser(u); localStorage.setItem('papaya_user', JSON.stringify(u)); })
      .catch(() => { localStorage.removeItem('papaya_token'); localStorage.removeItem('papaya_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 logout events
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('papaya:logout', handler);
    return () => window.removeEventListener('papaya:logout', handler);
  }, []);

  const saveAuth = useCallback(({ token, user: u }) => {
    localStorage.setItem('papaya_token', token);
    localStorage.setItem('papaya_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    saveAuth(data);
    return data;
  }, [saveAuth]);

  const register = useCallback(async (email, password, name) => {
    const data = await api.register({ email, password, name });
    saveAuth(data);
    return data;
  }, [saveAuth]);

  const googleLogin = useCallback(async (credential) => {
    const data = await api.googleAuth(credential);
    saveAuth(data);
    return data;
  }, [saveAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('papaya_token');
    localStorage.removeItem('papaya_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
