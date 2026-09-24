const express = require('express');
const { register, login, getMe, logout, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, registerRules, loginRules } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (rate-limited)
router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.patch('/profile', protect, updateProfile);
router.patch('/password', protect, changePassword);

module.exports = router;
