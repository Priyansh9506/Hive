const mongoose = require('mongoose');

/**
 * One signed-in browser. The browser holds a refresh token `<session id>.<secret>`
 * in an httpOnly cookie; only a SHA-256 hash of the secret is stored here, so a
 * database leak does not hand out working sessions.
 *
 * The secret is replaced on every refresh (rotation). The hash it replaced is
 * kept as `previousHash` so that two tabs refreshing at the same moment are not
 * mistaken for a stolen token being replayed.
 */
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    previousHash: {
      type: String,
      default: null,
    },
    rotatedAt: {
      type: Date,
      default: null,
    },
    // Pushed forward on every refresh, never past `expiresAt`
    idleExpiresAt: {
      type: Date,
      required: true,
    },
    // Hard limit from sign-in: after this the user must log in again however
    // active they are. The TTL index below deletes the document at this time.
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
