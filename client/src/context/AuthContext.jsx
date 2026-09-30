import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api, {
  SESSION_HINT_KEY,
  endLocalSession,
  hasSessionHint,
  refreshSession,
  setAccessToken,
} from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session from the refresh cookie, if this browser has one
  const restoreSession = useCallback(async () => {
    try {
      if (!hasSessionHint()) return;
      const data = await refreshSession();
      setUser(data.user);
    } catch (error) {
      if (error.response?.status !== 401) console.error('Failed to restore session:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    // The server refused to renew the session (see lib/api.js)
    const handleUnauthorized = (e) => {
      setUser(null);
      if (e.detail?.reason === 'expired') {
        toast.error('Your session has expired. Please log in again.', { id: 'session-expired' });
      }
    };

    // Another tab signed out (the hint was removed) or signed in (it appeared)
    const handleStorage = (e) => {
      if (e.key !== SESSION_HINT_KEY) return;
      if (e.newValue === null) {
        setAccessToken(null);
        setUser(null);
      } else {
        refreshSession()
          .then((data) => setUser(data.user))
          .catch(() => {});
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorage);
    };
  }, [restoreSession]);

  const signedIn = ({ token, user: userData }) => {
    setAccessToken(token);
    setUser(userData);
    return userData;
  };

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return signedIn(response.data);
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return signedIn(response.data);
  };

  // `credential` is the ID token Google Identity Services hands the page
  const loginWithGoogle = async (credential) => {
    const response = await api.post('/auth/google', { credential });
    return signedIn(response.data);
  };

  // Ends the session on the server too, so the refresh cookie stops working
  // even if it was copied
  const logout = async () => {
    endLocalSession();
    setUser(null);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
