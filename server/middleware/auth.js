const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes — verifies JWT and attaches user to req
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    // The session this access token was issued under (see utils/session.js)
    req.sessionId = decoded.sid;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — user not found',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — token invalid or expired',
    });
  }
};

module.exports = { protect };
