const Notification = require('../models/Notification');

// @desc    List the current user's notifications
// @route   GET /api/notifications?unreadOnly=true&limit=30
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const query = { userId: req.user.id };

    if (req.query.unreadOnly === 'true') {
      query.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user.id, read: false }),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark one notification as read
// @route   PATCH /api/notifications/:notificationId/read
// @access  Private
const markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      // Scoped to the caller so an id from elsewhere cannot be touched
      { _id: req.params.notificationId, userId: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });

    res.status(200).json({ success: true, notification, unreadCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark every notification as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification${result.modifiedCount === 1 ? '' : 's'} marked as read`,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.notificationId,
      userId: req.user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
