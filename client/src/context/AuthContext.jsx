import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api, {
  SESSION_HINT_KEY,
  endLocalSession,
  hasSessionHint,
  refreshSession,
  setAccessToken,
} from '../lib/api';
import { getCachedUser, setCachedUser, isNetworkError } from '../lib/offlineCache';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Signed in from the cached profile because the server could not be reached
  // (offline, or the host asleep). There is no access token yet, so live
  // features wait; the session is renewed as soon as the server answers.
  const [offlineSession, setOfflineSession] = useState(false);

  // Restore the session from the refresh cookie, if this browser has one
  const restoreSession = useCallback(async () => {
    try {
      if (!hasSessionHint()) return;
      const data = await refreshSession();
      setCachedUser(data.user);
      setUser(data.user);
    } catch (error) {
      const cached = getCachedUser();
      if (isNetworkError(error) && cached) {
        // No answer is not a refusal: the session is most likely still valid,
        // so stay signed in (notes edited now are kept on this device) and
        // only a real 401 from the server signs the user out
        setUser(cached);
        setOfflineSession(true);
      } else {
        if (error.response?.status !== 401) console.error('Failed to restore session:', error);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // While signed in offline, renew the session the moment the network returns
  // (and every so often, since "online" does not mean the server is reachable)
  useEffect(() => {
    if (!offlineSession) return;
    let cancelled = false;
    const retry = () => {
      if (!navigator.onLine) return;
      refreshSession()
        .then((data) => {
          if (cancelled) return;
          setCachedUser(data.user);
          setUser(data.user);
          setOfflineSession(false);
        })
        // A refusal ends the session through 'auth:unauthorized'; anything else
        // is still offline and the next attempt will try again
        .catch(() => {});
    };
    window.addEventListener('online', retry);
    const timer = setInterval(retry, 20 * 1000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [offlineSession]);

  useEffect(() => {
    restoreSession();

    // The server refused to renew the session (see lib/api.js)
    const handleUnauthorized = (e) => {
      setUser(null);
      setOfflineSession(false);
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
          .then((data) => {
            setCachedUser(data.user);
            setUser(data.user);
            setOfflineSession(false);
          })
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
    setCachedUser(userData);
    setUser(userData);
    setOfflineSession(false);
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
    // Signed in from cache without a live session (see offlineSession above)
    offlineSession,
    // Signed in with an access token: live features (socket, sync) can connect
    sessionReady: !!user && !offlineSession,
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
