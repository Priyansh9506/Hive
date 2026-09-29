const Notification = require('../models/Notification');

/**
 * Create an in-app notification and push it to the recipient's personal socket
 * room. Like activity logging, this is a side effect: failures are logged, not
 * propagated, so the action that triggered it still succeeds.
 *
 * @param {object}  entry
 * @param {string}  entry.userId   - recipient
 * @param {string}  entry.type     - one of Notification's enum values
 * @param {string}  entry.title
 * @param {string} [entry.body]
 * @param {string} [entry.link]    - client route to open
 * @param {string} [entry.spaceId]
 */
const notify = async ({ userId, type, title, body, link, spaceId }) => {
  try {
    const notification = await Notification.create({
      userId,
      spaceId: spaceId || null,
      type,
      title,
      body: body || '',
      link: link || '',
    });

    // Lazy require: config/socket.js loads models, so a top-level require here
    // would close the cycle.
    const { getIo } = require('../config/socket');
    getIo().to(`user:${userId}`).emit('notification_new', {
      _id: notification._id,
      spaceId: notification.spaceId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      read: notification.read,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    console.error(`Notification failed (${type}):`, err.message);
    return null;
  }
};

module.exports = notify;
