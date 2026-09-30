const jwt = require('jsonwebtoken');

// Short-lived access token. It is only a bearer pass for the next few minutes;
// staying signed in is the refresh token's job (see utils/session.js). `sid`
// names the session it was issued under, so a password change can keep the
// current session while ending the others.
const generateToken = (id, sessionId) => {
  return jwt.sign({ id, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });
};

module.exports = generateToken;
