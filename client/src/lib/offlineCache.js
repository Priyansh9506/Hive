/* ---------------------------------------------------------------------------
   Offline cache

   The last copy of what the API returned for a few read-only views (the
   signed-in profile, the spaces list, a space's details, recent chat), so the
   app can open and show them without a network. Never credentials: the access
   token stays in memory and the refresh token in an httpOnly cookie.

   Everything is scoped to one user and wiped when the session ends, so the
   next person on a shared browser does not see the previous person's spaces.
   The notes themselves are not here: Yjs keeps them in IndexedDB (see
   CollaborativeEditor), where offline edits wait until they can sync.
   --------------------------------------------------------------------------- */

const PREFIX = 'ss_cache:';
const USER_KEY = `${PREFIX}user`;

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the app still works online, just not offline
  }
};

/** The signed-in user's profile, kept so a reload while offline stays signed in */
export const getCachedUser = () => read(USER_KEY);
export const setCachedUser = (user) => user && write(USER_KEY, user);

const scoped = (key) => {
  const user = getCachedUser();
  return user?.id ? `${PREFIX}${user.id}:${key}` : null;
};

/** Last stored copy of `key` for the signed-in user, or null */
export const getCached = (key) => {
  const k = scoped(key);
  return k ? read(k) : null;
};

export const setCached = (key, value) => {
  const k = scoped(key);
  if (k) write(k, value);
};

/** Forget everything cached, on sign-out or when the server ends the session */
export function clearOfflineCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * A request that failed without any answer from the server: offline, DNS, the
 * server asleep. Those leave cached data in place; an actual answer (403, 404)
 * does not.
 */
export const isNetworkError = (err) => !!err && !err.response;
