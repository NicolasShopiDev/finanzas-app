'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
}

interface RegisterData {
  email: string;
  name: string;
  password: string;
  phone?: string;
}

interface VerifyData {
  email: string;
  code: string;
  password: string;
  name: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ code: string }>;
  verifyCode: (data: VerifyData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Safe fallback for PUBLIC routes when provider isn't mounted (prevents build crashes)
const fallbackAuth: AuthContextType = {
  user: null,
  loading: false,
  login: async () => {},
  register: async () => ({ code: '' }),
  verifyCode: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
  getToken: () => null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token');
    }
    return null;
  };

  const setToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth-token', token);
    }
  };

  const removeToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-token');
    }
  };

  const checkAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = (await res.json()) as { ok: boolean; data?: any };
      if (data.ok) {
        setUser(data.data);
      } else {
        setUser(null);
        removeToken();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      removeToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json()) as { ok: boolean; error?: any; data?: any };

    if (!data.ok) {
      throw new Error(data.error?.message || 'Error al iniciar sesión');
    }

    // Store token in localStorage
    setToken(data.data.token);
    setUser(data.data.user);
    router.push('/');
  };

  const register = async (registerData: RegisterData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData),
    });

    const data = (await res.json()) as { ok: boolean; error?: any; data?: any };

    if (!data.ok) {
      throw new Error(data.error?.message || 'Error al registrar');
    }

    return data.data as { code: string };
  };

  const verifyCode = async (verifyData: VerifyData) => {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyData),
    });

    const data = (await res.json()) as { ok: boolean; error?: any; data?: any };

    if (!data.ok) {
      throw new Error(data.error?.message || 'Error al verificar código');
    }

    // Store token in localStorage
    setToken(data.data.token);
    setUser(data.data.user);
    router.push('/');
  };

  const logout = async () => {
    const token = getToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    removeToken();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyCode, logout, checkAuth, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Strict hook for PRIVATE routes/components.
 * Throws if used outside <AuthProvider>.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Non-throwing hook for PUBLIC routes/components.
 * Returns a safe fallback if <AuthProvider> isn't mounted yet.
 */
export function useAuthOptional(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return fallbackAuth;
  }
  return context;
}
