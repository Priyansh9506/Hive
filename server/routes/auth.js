const express = require('express');
const { register, login, getMe, refresh, logout, updateProfile, changePassword, uploadAvatar, googleLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, registerRules, loginRules } = require('../middleware/validate');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { uploadSingle } = require('../middleware/upload');

const router = express.Router();

// Public routes (rate-limited)
router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/google', authLimiter, googleLogin);

// Session routes: the httpOnly refresh cookie is the credential, so these work
// after the short-lived access token has run out
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', refreshLimiter, logout);

// Protected routes
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.patch('/password', protect, changePassword);
router.post('/avatar', protect, uploadSingle('avatar'), uploadAvatar);

module.exports = router;
