const Activity = require('../models/Activity');

/**
 * Append an entry to a space's activity feed and push it to everyone in the room.
 *
 * Activity is a side effect of the real action, never the point of it, so a
 * failure here is logged and swallowed: pinning a message must not 500 because
 * the feed write failed. Callers may `await` it but are not required to.
 *
 * @param {object}  entry
 * @param {string}  entry.spaceId
 * @param {object}  entry.user        - `{ id, name }` (a Mongoose user or socket.user both fit)
 * @param {string}  entry.type        - one of Activity's enum values
 * @param {string}  entry.summary     - e.g. "added DBMS notes"
 * @param {string} [entry.targetType]
 * @param {string} [entry.targetId]
 */
const logActivity = async ({ spaceId, user, type, summary, targetType, targetId }) => {
  try {
    const activity = await Activity.create({
      spaceId,
      userId: user.id || user._id,
      userName: user.name,
      type,
      summary,
      targetType: targetType || 'space',
      targetId: targetId || null,
    });

    // Required lazily: config/socket.js pulls in models, and a top-level require
    // here would close the cycle before either module finished loading.
    const { getIo } = require('../config/socket');
    getIo().to(`space:${spaceId}`).emit('activity_new', {
      _id: activity._id,
      spaceId: activity.spaceId,
      userId: activity.userId,
      userName: activity.userName,
      type: activity.type,
      summary: activity.summary,
      targetType: activity.targetType,
      targetId: activity.targetId,
      createdAt: activity.createdAt,
    });

    return activity;
  } catch (err) {
    console.error(`Activity log failed (${type}):`, err.message);
    return null;
  }
};

module.exports = logActivity;
