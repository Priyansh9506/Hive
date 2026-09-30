import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// withCredentials: the refresh token lives in an httpOnly cookie set by the
// API's own origin, which the browser only stores and sends on cross-origin
// requests that opt in to credentials
const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* ---------------------------------------------------------------------------
   Session tokens

   The access token is short-lived (15 min) and kept in memory only, never in
   storage a script could read later. The refresh token is an httpOnly cookie
   this code never sees; POST /auth/refresh trades it for a new access token.
   The session ends, and the user has to log in again, once the server refuses
   a refresh: signed out, a day unused, a week old, or a replayed token.
   --------------------------------------------------------------------------- */

let accessToken = null;
let refreshTimer = null;
let refreshing = null;

// Not a credential: only marks "this browser has signed in", so the page skips
// a refresh call that would certainly fail for visitors who never have, and so
// other tabs hear about sign-in and sign-out (see AuthContext)
export const SESSION_HINT_KEY = 'ss_session';

const setHint = (on) => {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage blocked: every load simply asks the server
  }
};

export const hasSessionHint = () => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) !== null;
  } catch {
    return true;
  }
};

// Tokens from before refresh tokens existed; no longer used
try {
  localStorage.removeItem('token');
} catch {
  // ignore
}

export const getAccessToken = () => accessToken;

const expiresAt = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

/** Store a new access token and schedule its renewal a minute before it runs out */
export function setAccessToken(token) {
  accessToken = token;
  clearTimeout(refreshTimer);
  if (!token) return;
  setHint(true);
  const exp = expiresAt(token);
  if (exp) {
    const delay = Math.max(exp - Date.now() - 60 * 1000, 5 * 1000);
    refreshTimer = setTimeout(() => refreshSession().catch(() => {}), delay);
  }
}

/** Forget the session in this tab. `reason` reaches AuthContext for the message. */
export function endLocalSession(reason) {
  setAccessToken(null);
  setHint(false);
  if (reason) window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { reason } }));
}

/**
 * Trade the refresh cookie for a new access token. Concurrent callers share
 * one request. Only an explicit refusal (401) ends the session; a network
 * error (server asleep, offline) leaves it to be retried.
 *
 * @returns {Promise<{ token: string, user: object }>}
 */
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.token);
        return res.data;
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          endLocalSession(err.response.data?.reason === 'missing' ? 'signed-out' : 'expired');
        }
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// Timers are paused while a laptop sleeps, so the token may have run out by
// the time the tab is looked at again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !accessToken) return;
  const exp = expiresAt(accessToken);
  if (exp && exp - Date.now() < 60 * 1000) refreshSession().catch(() => {});
});

// Attach the access token to every request
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const SESSION_ROUTES = /\/auth\/(login|register|google|refresh|logout)$/;

// A 401 usually means the access token ran out: refresh once and replay the
// request. If the refresh is refused, refreshSession has already ended the
// session. A 401 that survives a successful refresh is the endpoint's own
// answer (e.g. a wrong current password) and is passed through as is.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !SESSION_ROUTES.test(original.url || '') &&
      hasSessionHint()
    ) {
      original._retried = true;
      try {
        await refreshSession();
      } catch {
        return Promise.reject(error);
      }
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

export default api;
