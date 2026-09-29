const express = require('express');
const { search } = require('../controllers/searchController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/', protect, apiLimiter, search);

module.exports = router;
