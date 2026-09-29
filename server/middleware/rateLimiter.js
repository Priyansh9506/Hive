const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Strict limiter for auth endpoints (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads cost disk, so they get a tighter budget than ordinary reads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many uploads. Please wait a few minutes before adding more files.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Outbound email is the one endpoint that can be turned into a spam relay,
// so it is limited hard and per user rather than per IP.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  // Authenticated requests key on the user; the IP fallback goes through the
  // library's helper so an IPv6 client cannot sidestep the limit by rotating
  // addresses inside its /64.
  keyGenerator: (req, res) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req, res)),
  message: {
    success: false,
    message: 'Invite email limit reached. Please try again later, or share the invite link directly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Every AI request spends the shared Gemini quota, so each member gets their
// own budget rather than one busy study group locking out everyone behind an IP.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req, res) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req, res)),
  message: {
    success: false,
    message: 'AI assistant limit reached. Please wait a few minutes before asking again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, uploadLimiter, emailLimiter, aiLimiter };
