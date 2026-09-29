const Membership = require('../models/Membership');

// Space routes spell the id differently: `/spaces/:id` vs nested `/spaces/:spaceId/...`.
const spaceIdFrom = (req) => req.params.spaceId || req.params.id;

// Loads the caller's membership for the space and attaches it to the request.
// Every space-scoped route goes through this, so controllers can trust
// `req.membership` / `req.spaceId` instead of re-querying.
const requireMember = async (req, res, next) => {
  try {
    const spaceId = spaceIdFrom(req);
    if (!spaceId) {
      return res.status(400).json({ success: false, message: 'Space id is required' });
    }

    const membership = await Membership.findOne({ spaceId, userId: req.user.id });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this space' });
    }

    req.membership = membership;
    req.spaceId = spaceId;
    next();
  } catch (error) {
    next(error);
  }
};

// Must run after requireMember. Owner-only actions per PRD §22: delete the space,
// manage members, manage invite settings, pin/unpin global content.
const requireOwner = (req, res, next) => {
  if (req.membership?.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Only the space owner can perform this action' });
  }
  next();
};

module.exports = { requireMember, requireOwner };
