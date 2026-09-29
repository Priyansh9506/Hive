const Membership = require('../models/Membership');
const StudySpace = require('../models/StudySpace');
const logActivity = require('../utils/logActivity');
const { getIo } = require('../config/socket');

// @desc    List members of a space
// @route   GET /api/spaces/:spaceId/members
// @access  Private (Member only)
const getMembers = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ spaceId: req.spaceId })
      .populate('userId', 'name email avatarUrl')
      .sort({ createdAt: 1 })
      .lean();

    const members = memberships
      .filter((m) => m.userId) // skip rows whose user was deleted
      .map((m) => ({
        membershipId: m._id,
        userId: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        avatarUrl: m.userId.avatarUrl || '',
        role: m.role,
        joinedAt: m.createdAt,
      }))
      // Owner first, then join order. Sorting by the `role` string would put
      // 'member' ahead of 'owner' alphabetically, so rank it explicitly.
      .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));

    res.status(200).json({
      success: true,
      count: members.length,
      members,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Leave a space
// @route   POST /api/spaces/:spaceId/leave
// @access  Private (Member only)
const leaveSpace = async (req, res, next) => {
  try {
    // The owner would leave the space unmanaged — they delete it or transfer it instead.
    if (req.membership.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'The owner cannot leave a space. Transfer ownership or delete the space instead.',
      });
    }

    await Membership.deleteOne({ _id: req.membership._id });

    const space = await StudySpace.findById(req.spaceId).select('name');

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'member_left',
      summary: 'left the space',
      targetType: 'member',
      targetId: req.user.id,
    });

    // Push the removal so open workspaces drop them from the member list
    getIo().to(`space:${req.spaceId}`).emit('member_removed', {
      spaceId: req.spaceId,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: `You have left ${space?.name || 'the space'}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a member from a space
// @route   DELETE /api/spaces/:spaceId/members/:userId
// @access  Private (Owner only)
const removeMember = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove yourself. Delete the space instead.',
      });
    }

    const target = await Membership.findOne({ spaceId: req.spaceId, userId })
      .populate('userId', 'name');

    if (!target) {
      return res.status(404).json({ success: false, message: 'That user is not a member of this space' });
    }

    await Membership.deleteOne({ _id: target._id });

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'member_removed',
      summary: `removed ${target.userId?.name || 'a member'} from the space`,
      targetType: 'member',
      targetId: userId,
    });

    const io = getIo();
    io.to(`space:${req.spaceId}`).emit('member_removed', {
      spaceId: req.spaceId,
      userId,
    });
    // Tell the removed user directly — they may have the workspace open
    io.to(`user:${userId}`).emit('space_access_revoked', {
      spaceId: req.spaceId,
    });

    res.status(200).json({
      success: true,
      message: `${target.userId?.name || 'Member'} removed from the space`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMembers, leaveSpace, removeMember };
