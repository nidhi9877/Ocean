import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

function decodeJwtPayload(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(jwtToken) {
  if (!jwtToken) return true;
  const payload = decodeJwtPayload(jwtToken);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved auth from localStorage
    const savedToken = localStorage.getItem('marine_token');
    const savedUser = localStorage.getItem('marine_user');

    if (savedToken && savedUser) {
      if (isTokenExpired(savedToken)) {
        localStorage.removeItem('marine_token');
        localStorage.removeItem('marine_user');
        setToken(null);
        setUser(null);
      } else {
        setToken(savedToken);
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser(null);
          localStorage.removeItem('marine_user');
        }
      }
    }
    setLoading(false);
  }, []);

  // Global response interceptor to handle expired/invalid tokens
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const errorMsg = error.response?.data?.error;
        const status = error.response?.status;

        if (
          status === 401 ||
          (status === 403 && (errorMsg === 'Invalid or expired token' || errorMsg?.includes('Session expired')))
        ) {
          if (localStorage.getItem('marine_token')) {
            localStorage.removeItem('marine_token');
            localStorage.removeItem('marine_user');
            setUser(null);
            setToken(null);
            toast.error('Your session has expired. Please log in again.');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('marine_token', authToken);
    localStorage.setItem('marine_user', JSON.stringify(userData));
  };

  const logout = async () => {
    if (token) {
      try {
        await axios.post('/api/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('marine_token');
    localStorage.removeItem('marine_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
