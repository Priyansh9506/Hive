const express = require('express');
const {
  createSpace,
  getSpaces,
  joinSpace,
  getSpace,
  updateSpace,
  deleteSpace,
} = require('../controllers/spaceController');
const { getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply auth protect and rate limiting to all space routes
router.use(protect);
router.use(apiLimiter);

router.route('/')
  .post(createSpace)
  .get(getSpaces);

router.post('/join', joinSpace);

router.route('/:id')
  .get(getSpace)
  .patch(updateSpace)
  .delete(deleteSpace);

// Nested message routes
router.get('/:spaceId/messages', getMessages);

module.exports = router;
