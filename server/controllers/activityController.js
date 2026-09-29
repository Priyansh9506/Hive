const Activity = require('../models/Activity');

// @desc    Chronological activity feed for a space (PRD §19)
// @route   GET /api/spaces/:spaceId/activity?limit=50&before=<ISO date>
// @access  Private (Member only)
const getActivity = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const query = { spaceId: req.spaceId };

    if (req.query.before) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = activities.length > limit;
    if (hasMore) activities.pop();

    res.status(200).json({
      success: true,
      count: activities.length,
      hasMore,
      activities,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActivity };
