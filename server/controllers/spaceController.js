const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const StudySpace = require('../models/StudySpace');
const Membership = require('../models/Membership');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const Highlight = require('../models/Highlight');
const Pin = require('../models/Pin');
const Activity = require('../models/Activity');
const DocumentSnapshot = require('../models/DocumentSnapshot');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logActivity = require('../utils/logActivity');
const notify = require('../utils/notify');
const { getIo } = require('../config/socket');
const { generateJoinCode, normalizeJoinCode } = require('../utils/joinCode');

// @desc    Create a new study space
// @route   POST /api/spaces
// @access  Private
const createSpace = async (req, res, next) => {
  try {
    const { name, description, icon, color } = req.body;

    const space = await StudySpace.create({
      name,
      description,
      ownerId: req.user.id,
      joinCode: await generateJoinCode(),
      icon: icon || 'book',
      color: color || '#6366f1',
    });

    // Add creator as the owner in memberships
    await Membership.create({
      spaceId: space._id,
      userId: req.user.id,
      role: 'owner',
    });

    await logActivity({
      spaceId: space._id,
      user: req.user,
      type: 'space_created',
      summary: `created the space "${space.name}"`,
      targetType: 'space',
      targetId: space._id,
    });

    // Return space with member count (1 initially)
    const spaceData = space.toObject();
    spaceData.membersCount = 1;
    spaceData.userRole = 'owner';

    res.status(201).json({
      success: true,
      space: spaceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all spaces for the current user
// @route   GET /api/spaces
// @access  Private
const getSpaces = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ userId: req.user.id })
      .populate('spaceId')
      .sort({ createdAt: -1 });

    const live = memberships.filter((m) => m.spaceId);

    // One grouped count query rather than one per space
    const counts = await Membership.aggregate([
      { $match: { spaceId: { $in: live.map((m) => m.spaceId._id) } } },
      { $group: { _id: '$spaceId', count: { $sum: 1 } } },
    ]);
    const countBySpace = new Map(counts.map((c) => [String(c._id), c.count]));

    // Unread = messages from other people since this member last read the
    // discussion (or since they joined). Also one grouped query for all spaces.
    const unread = live.length
      ? await Message.aggregate([
          {
            $match: {
              $or: live.map((m) => ({
                spaceId: m.spaceId._id,
                createdAt: { $gt: m.lastReadAt || m.createdAt },
              })),
              senderId: { $ne: new mongoose.Types.ObjectId(req.user.id) },
              deletedAt: null,
            },
          },
          { $group: { _id: '$spaceId', count: { $sum: 1 } } },
        ])
      : [];
    const unreadBySpace = new Map(unread.map((u) => [String(u._id), u.count]));

    const spaces = live.map((membership) => {
      const spaceData = membership.spaceId.toObject();
      spaceData.membersCount = countBySpace.get(String(membership.spaceId._id)) || 1;
      spaceData.userRole = membership.role;
      spaceData.unreadCount = unreadBySpace.get(String(membership.spaceId._id)) || 0;
      return spaceData;
    });

    res.status(200).json({
      success: true,
      count: spaces.length,
      spaces,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join a space via code
// @route   POST /api/spaces/join
// @access  Private
const joinSpace = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a join code' });
    }

    const space = await StudySpace.findOne({ joinCode: normalizeJoinCode(code) });

    if (!space) {
      return res.status(404).json({ success: false, message: 'Invalid join code' });
    }

    if (!space.inviteEnabled) {
      return res.status(403).json({ success: false, message: 'Invites are currently disabled for this space' });
    }

    if (space.joinCodeExpiresAt && space.joinCodeExpiresAt < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'This invite code has expired. Ask the space owner for a new one.',
      });
    }

    if (space.joinCodeMaxUses !== null && space.joinCodeUses >= space.joinCodeMaxUses) {
      return res.status(403).json({
        success: false,
        message: 'This invite code has reached its maximum number of uses.',
      });
    }

    // Check if already a member
    const existingMembership = await Membership.findOne({
      spaceId: space._id,
      userId: req.user.id,
    });

    if (existingMembership) {
      return res.status(400).json({ success: false, message: 'You are already a member of this space' });
    }

    await Membership.create({
      spaceId: space._id,
      userId: req.user.id,
      role: 'member',
    });

    // Only a join that actually happened counts against the limit
    await StudySpace.updateOne({ _id: space._id }, { $inc: { joinCodeUses: 1 } });

    await logActivity({
      spaceId: space._id,
      user: req.user,
      type: 'member_joined',
      summary: 'joined the space',
      targetType: 'member',
      targetId: req.user.id,
    });

    // Tell the owner someone joined (PRD §24), unless they joined their own space
    if (String(space.ownerId) !== String(req.user.id)) {
      await notify({
        userId: space.ownerId,
        spaceId: space._id,
        type: 'member_joined',
        title: `${req.user.name} joined ${space.name}`,
        body: 'They can now edit the shared notes and take part in the discussion.',
        link: `/spaces/${space._id}`,
      });
    }

    const membersCount = await Membership.countDocuments({ spaceId: space._id });
    const spaceData = space.toObject();
    spaceData.membersCount = membersCount;
    spaceData.userRole = 'member';
    spaceData.joinCodeUses = space.joinCodeUses + 1;

    res.status(200).json({
      success: true,
      message: `Successfully joined ${space.name}`,
      space: spaceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview a space behind an invite code without joining it, so the
//          join screen can name the space before the user commits (PRD §10.1)
// @route   GET /api/spaces/invite/:code
// @access  Private
const previewInvite = async (req, res, next) => {
  try {
    const space = await StudySpace.findOne({ joinCode: normalizeJoinCode(req.params.code) }).select(
      'name description icon color ownerId inviteEnabled joinCodeExpiresAt joinCodeMaxUses joinCodeUses'
    );

    if (!space) {
      return res.status(404).json({ success: false, message: 'Invalid invite code' });
    }

    const expired = Boolean(space.joinCodeExpiresAt && space.joinCodeExpiresAt < new Date());
    const exhausted = space.joinCodeMaxUses !== null && space.joinCodeUses >= space.joinCodeMaxUses;

    const [owner, membersCount, membership] = await Promise.all([
      User.findById(space.ownerId).select('name'),
      Membership.countDocuments({ spaceId: space._id }),
      Membership.findOne({ spaceId: space._id, userId: req.user.id }),
    ]);

    res.status(200).json({
      success: true,
      invite: {
        spaceId: space._id,
        name: space.name,
        description: space.description,
        icon: space.icon,
        color: space.color,
        ownerName: owner?.name || 'Unknown',
        membersCount,
        alreadyMember: Boolean(membership),
        valid: space.inviteEnabled && !expired && !exhausted,
        reason: !space.inviteEnabled
          ? 'Invites are currently disabled for this space'
          : expired
            ? 'This invite code has expired'
            : exhausted
              ? 'This invite code has reached its maximum number of uses'
              : '',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single space details
// @route   GET /api/spaces/:id
// @access  Private (Member only)
const getSpace = async (req, res, next) => {
  try {
    const space = await StudySpace.findById(req.spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    const membersCount = await Membership.countDocuments({ spaceId: space._id });

    const spaceData = space.toObject();
    spaceData.membersCount = membersCount;
    spaceData.userRole = req.membership.role;

    res.status(200).json({
      success: true,
      space: spaceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a study space (name, description, icon, color)
// @route   PATCH /api/spaces/:id
// @access  Private (Owner only)
const updateSpace = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'description', 'icon', 'color', 'inviteEnabled'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const space = await StudySpace.findByIdAndUpdate(req.spaceId, updates, {
      new: true,
      runValidators: true,
    });

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    await logActivity({
      spaceId: space._id,
      user: req.user,
      type: 'space_updated',
      summary: `updated the space (${Object.keys(updates).join(', ')})`,
      targetType: 'space',
      targetId: space._id,
    });

    const membersCount = await Membership.countDocuments({ spaceId: space._id });
    const spaceData = space.toObject();
    spaceData.membersCount = membersCount;
    spaceData.userRole = 'owner';

    res.status(200).json({
      success: true,
      space: spaceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a study space and all related data
// @route   DELETE /api/spaces/:id
// @access  Private (Owner only)
const deleteSpace = async (req, res, next) => {
  try {
    const space = await StudySpace.findById(req.spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Remove uploaded files from disk before the rows pointing at them go
    const uploads = await Resource.find({
      spaceId: space._id,
      'metadata.storedName': { $nin: ['', null] },
    })
      .select('metadata.storedName')
      .lean();

    const uploadDir = path.join(__dirname, '..', 'uploads');
    await Promise.all(
      uploads.map((r) => fs.unlink(path.join(uploadDir, r.metadata.storedName)).catch(() => {}))
    );

    await Promise.all([
      Message.deleteMany({ spaceId: space._id }),
      Resource.deleteMany({ spaceId: space._id }),
      Highlight.deleteMany({ spaceId: space._id }),
      Pin.deleteMany({ spaceId: space._id }),
      Activity.deleteMany({ spaceId: space._id }),
      DocumentSnapshot.deleteMany({ spaceId: space._id }),
      Notification.deleteMany({ spaceId: space._id }),
      Membership.deleteMany({ spaceId: space._id }),
    ]);
    await StudySpace.findByIdAndDelete(space._id);

    // Anyone with the workspace open is looking at a space that no longer exists
    getIo().to(`space:${space._id}`).emit('space_deleted', {
      spaceId: space._id,
      name: space.name,
    });

    res.status(200).json({
      success: true,
      message: 'Study space and all related data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update shared notes content for a space
// @route   PATCH /api/spaces/:id/notes
// @access  Private (Member only)
const updateNotes = async (req, res, next) => {
  try {
    const { notesContent } = req.body;

    const space = await StudySpace.findByIdAndUpdate(
      req.spaceId,
      {
        notesContent: typeof notesContent === 'string' ? notesContent : '',
        lastSavedAt: new Date(),
      },
      { new: true }
    );

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    res.status(200).json({
      success: true,
      notesContent: space.notesContent,
      lastSavedAt: space.lastSavedAt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSpace,
  getSpaces,
  joinSpace,
  previewInvite,
  getSpace,
  updateSpace,
  deleteSpace,
  updateNotes,
};
