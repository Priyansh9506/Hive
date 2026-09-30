const { getIo } = require('../config/socket');

/**
 * Live updates that reach every member of a space, wherever they are in the
 * app, not only the ones with the workspace open.
 *
 * Rooms:
 *   space:<id>   sockets with the workspace open (chat, presence, panels)
 *   watch:<id>   every open socket of every member (dashboard cards, headers).
 *                Joined on connect for all of a user's spaces, and kept in
 *                step here as people join, leave or are removed.
 *   user:<id>    all of one user's sockets
 *
 * A socket in both space and watch rooms still gets each event once:
 * Socket.IO de-duplicates when emitting to several rooms at once.
 */
const watchRoom = (spaceId) => `watch:${spaceId}`;
const spaceRooms = (spaceId) => [`space:${spaceId}`, watchRoom(spaceId)];

const toSpace = (spaceId) => getIo().to(spaceRooms(spaceId));

/** Start delivering a space's live updates to all of a user's open tabs */
const watchSpace = (userId, spaceId) => getIo().in(`user:${userId}`).socketsJoin(watchRoom(spaceId));

/** Stop them, and take the user out of the workspace room too */
const unwatchSpace = (userId, spaceId) =>
  getIo().in(`user:${userId}`).socketsLeave(spaceRooms(spaceId));

/**
 * Something shown on a space's card or header changed.
 * @param {object} changes e.g. { name, description, membersCount }
 */
const emitSpaceUpdated = (spaceId, changes) =>
  toSpace(spaceId).emit('space_updated', { spaceId: String(spaceId), ...changes });

module.exports = { watchRoom, spaceRooms, toSpace, watchSpace, unwatchSpace, emitSpaceUpdated };
