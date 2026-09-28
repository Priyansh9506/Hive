const Message = require('../models/Message');
const Membership = require('../models/Membership');

// @desc    Get message history for a space (paginated, newest-first)
// @route   GET /api/spaces/:spaceId/messages?before=<cursor>&limit=40
// @access  Private (Member only)
const getMessages = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const before = req.query.before; // cursor: createdAt ISO string of the oldest loaded message

    // Verify membership
    const membership = await Membership.findOne({ spaceId, userId: req.user.id });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member of this space' });
    }

    // Build query
    const query = { spaceId };
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

module.exports = { getMessages };
