import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api.js';

const AuthContext = createContext(null);
const AUTH_BACKEND = String(import.meta.env.VITE_AUTH_BACKEND || 'php').toLowerCase();
const PHP_USER_KEY = 'php_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token && AUTH_BACKEND === 'php') {
      const cached = localStorage.getItem(PHP_USER_KEY);
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          localStorage.removeItem(PHP_USER_KEY);
        }
      }
      setLoading(false);
      return;
    }

    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch('/api/auth/me')
      .then((data) => setUser(data?.user || null))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const loginWithToken = (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    return apiFetch('/api/auth/me').then((data) => setUser(data?.user || null));
  };

  const loginWithResponse = async (data) => {
    if (data?.token) {
      await loginWithToken(data.token);
      return;
    }

    if (data?.user) {
      setUser(data.user);
      if (AUTH_BACKEND === 'php') {
        localStorage.setItem(PHP_USER_KEY, JSON.stringify(data.user));
      }
      return;
    }

    throw new Error('Invalid login response');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(PHP_USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loginWithToken, loginWithResponse, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
