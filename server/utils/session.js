const crypto = require('crypto');
const Session = require('../models/Session');

const COOKIE_NAME = 'ss_refresh';
// Only the auth routes ever need the refresh token, so the browser sends it
// nowhere else
const COOKIE_PATH = '/api/auth';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Signed out after this long without the app open...
const IDLE_MS = Number(process.env.SESSION_IDLE_HOURS || 24) * HOUR;
// ...and after this long from sign-in, however active
const MAX_MS = Number(process.env.SESSION_MAX_DAYS || 7) * DAY;
// Two tabs can refresh with the same cookie at once. The slower one presents
// the hash that was just rotated out; within this window that is a race, not
// a replayed stolen token.
const ROTATION_GRACE_MS = 30 * 1000;

const hash = (secret) => crypto.createHash('sha256').update(secret).digest('hex');
const newSecret = () => crypto.randomBytes(32).toString('base64url');

/** `<session id>.<secret>` → parts, or null if the cookie is malformed */
const parseRefreshToken = (raw) => {
  if (typeof raw !== 'string') return null;
  const [id, secret, extra] = raw.split('.');
  if (!id || !secret || extra !== undefined || !/^[a-f0-9]{24}$/.test(id)) return null;
  return { id, secret };
};

// The client and API are usually on different sites in production, so the
// cookie has to be SameSite=None, which browsers only accept with Secure (and
// so only over HTTPS). Local development over plain http keeps Lax.
const cookieOptions = (req) => {
  const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const secure = req.secure || proto === 'https';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    // Keyed to the client's site (CHIPS), which is how Chrome keeps
    // cross-site cookies working
    partitioned: secure,
    path: COOKIE_PATH,
  };
};

const setRefreshCookie = (req, res, sessionId, secret, expires) => {
  res.cookie(COOKIE_NAME, `${sessionId}.${secret}`, { ...cookieOptions(req), expires });
};

const clearRefreshCookie = (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
};

const readRefreshCookie = (req) => parseRefreshToken(req.cookies?.[COOKIE_NAME]);

const earliest = (a, b) => (a < b ? a : b);

/** Start a session for a user who just signed in, and hand the browser its cookie */
const startSession = async (req, res, userId) => {
  const now = Date.now();
  const secret = newSecret();
  const expiresAt = new Date(now + MAX_MS);
  const idleExpiresAt = earliest(new Date(now + IDLE_MS), expiresAt);

  const session = await Session.create({
    userId,
    tokenHash: hash(secret),
    idleExpiresAt,
    expiresAt,
    userAgent: (req.get('user-agent') || '').slice(0, 300),
    ip: req.ip || '',
  });

  setRefreshCookie(req, res, session._id, secret, idleExpiresAt);
  return session;
};

/**
 * Exchange the refresh cookie for a new one.
 *
 * @returns {Promise<{ ok: true, session } | { ok: false, reason: string }>}
 */
const rotateSession = async (req, res) => {
  const parsed = readRefreshCookie(req);
  if (!parsed) return { ok: false, reason: 'missing' };

  const presented = hash(parsed.secret);
  const now = new Date();
  const secret = newSecret();
  const nextHash = hash(secret);

  // Atomic, so two concurrent refreshes cannot both rotate the same secret
  // and leave the browser holding a cookie the database no longer knows.
  const rotated = await Session.findOneAndUpdate(
    {
      _id: parsed.id,
      tokenHash: presented,
      revokedAt: null,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    },
    [
      {
        $set: {
          previousHash: '$tokenHash',
          tokenHash: nextHash,
          rotatedAt: now,
          idleExpiresAt: { $min: [new Date(now.getTime() + IDLE_MS), '$expiresAt'] },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

  if (rotated) {
    setRefreshCookie(req, res, rotated._id, secret, rotated.idleExpiresAt);
    return { ok: true, session: rotated };
  }

  // Not the current secret. Work out why.
  const session = await Session.findById(parsed.id);
  if (!session || session.revokedAt) return { ok: false, reason: 'revoked' };
  if (session.expiresAt <= now || session.idleExpiresAt <= now) return { ok: false, reason: 'expired' };

  if (
    session.previousHash === presented &&
    session.rotatedAt &&
    now - session.rotatedAt < ROTATION_GRACE_MS
  ) {
    // Lost a race with another tab, whose response already gave this browser
    // the new cookie. Answer without rotating again.
    return { ok: true, session };
  }

  // An old secret, outside the race window: someone is replaying a stolen
  // token. End the session so neither copy works any more.
  session.revokedAt = now;
  await session.save();
  return { ok: false, reason: 'reused' };
};

/** End the session behind the request's cookie, if the cookie is genuine */
const endSession = async (req) => {
  const parsed = readRefreshCookie(req);
  if (!parsed) return;
  const presented = hash(parsed.secret);
  await Session.updateOne(
    { _id: parsed.id, revokedAt: null, $or: [{ tokenHash: presented }, { previousHash: presented }] },
    { $set: { revokedAt: new Date() } }
  );
};

/** End every session of a user except (optionally) one */
const endOtherSessions = (userId, keepSessionId) =>
  Session.updateMany(
    { userId, revokedAt: null, ...(keepSessionId ? { _id: { $ne: keepSessionId } } : {}) },
    { $set: { revokedAt: new Date() } }
  );

module.exports = {
  startSession,
  rotateSession,
  endSession,
  endOtherSessions,
  clearRefreshCookie,
};
