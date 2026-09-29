const express = require('express');
const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(apiLimiter);

router.get('/', getNotifications);
// Declared before the :notificationId route so "read-all" is not read as an id
router.patch('/read-all', markAllRead);
router.patch('/:notificationId/read', markRead);
router.delete('/:notificationId', deleteNotification);

module.exports = router;
