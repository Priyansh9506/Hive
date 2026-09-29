const Message = require('../models/Message');
const Pin = require('../models/Pin');
const Highlight = require('../models/Highlight');
const { getIo } = require('../config/socket');

// @desc    Get message history for a space (paginated, newest-first)
// @route   GET /api/spaces/:spaceId/messages?before=<cursor>&limit=40
// @access  Private (Member only)
const getMessages = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);
    const before = req.query.before; // cursor: createdAt ISO string of the oldest loaded message

    const query = { spaceId: req.spaceId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Fetch one extra to know if there are more
      .lean();

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop(); // Remove the extra one

    // Return in chronological order (oldest first) for the client
    messages.reverse();

    res.status(200).json({
      success: true,
      messages,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit a message
// @route   PATCH /api/spaces/:spaceId/messages/:messageId
// @access  Private (Sender only)
const updateMessage = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    const message = await Message.findOne({ _id: req.params.messageId, spaceId: req.spaceId });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Editing is the sender's alone — not even the owner rewrites what someone said
    if (String(message.senderId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    if (message.deletedAt) {
      return res.status(400).json({ success: false, message: 'This message has been deleted' });
    }

    message.content = String(content).trim();
    message.editedAt = new Date();
    await message.save();

    const payload = {
      _id: message._id,
      spaceId: message.spaceId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      isPinned: message.isPinned,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
    };

    getIo().to(`space:${req.spaceId}`).emit('message_updated', payload);

    res.status(200).json({ success: true, message: payload });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a message
// @route   DELETE /api/spaces/:spaceId/messages/:messageId
// @access  Private (Sender or space owner)
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.messageId, spaceId: req.spaceId });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const isSender = String(message.senderId) === String(req.user.id);
    if (!isSender && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the sender or the space owner can delete this message',
      });
    }

    // Soft delete: replies pointing here still resolve, and the chat keeps its
    // shape rather than silently losing a turn in the conversation.
    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    message.attachments = [];
    message.isPinned = false;
    await message.save();

    // A deleted message should not linger in the pins or highlights panel
    await Promise.all([
      Pin.deleteMany({ spaceId: req.spaceId, sourceType: 'message', sourceId: message._id }),
      Highlight.deleteMany({ spaceId: req.spaceId, sourceType: 'message', sourceId: message._id }),
    ]);

    getIo().to(`space:${req.spaceId}`).emit('message_deleted', {
      spaceId: req.spaceId,
      messageId: message._id,
      deletedAt: message.deletedAt,
    });

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark the discussion as read up to now
// @route   POST /api/spaces/:spaceId/read
// @access  Private (Member only)
const markRead = async (req, res, next) => {
  try {
    const lastReadAt = new Date();
    // req.membership was loaded by requireMember; update it in place
    await req.membership.updateOne({ lastReadAt });

    res.status(200).json({ success: true, lastReadAt });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMessages, updateMessage, deleteMessage, markRead };
