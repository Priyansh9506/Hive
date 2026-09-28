const StudySpace = require('../models/StudySpace');
const Membership = require('../models/Membership');
const Message = require('../models/Message');
const { nanoid } = require('nanoid');

// @desc    Create a new study space
// @route   POST /api/spaces
// @access  Private
const createSpace = async (req, res, next) => {
  try {
    const { name, description, icon, color } = req.body;

    // Generate a unique 7-character join code (e.g. 7KQ-9PM)
    const rawCode = nanoid(6).toUpperCase();
    const joinCode = `${rawCode.slice(0, 3)}-${rawCode.slice(3, 6)}`;

    // Create the space
    const space = await StudySpace.create({
      name,
      description,
      ownerId: req.user.id,
      joinCode,
      icon: icon || 'book',
      color: color || '#6366f1',
    });

    // Add creator as the owner in memberships
    await Membership.create({
      spaceId: space._id,
      userId: req.user.id,
      role: 'owner',
    });

    // Return space with member count (1 initially)
    const spaceData = space.toObject();
    spaceData.membersCount = 1;

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
    // Find all memberships for this user
    const memberships = await Membership.find({ userId: req.user.id })
      .populate('spaceId')
      .sort({ createdAt: -1 });

    const spaces = [];

    // For each space, get the total member count
    for (const membership of memberships) {
      if (membership.spaceId) {
        const membersCount = await Membership.countDocuments({ spaceId: membership.spaceId._id });
        const spaceData = membership.spaceId.toObject();
        spaceData.membersCount = membersCount;
        spaceData.userRole = membership.role;
        spaces.push(spaceData);
      }
    }

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
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide a join code' });
    }

    const space = await StudySpace.findOne({ joinCode: code });
    
    if (!space) {
      return res.status(404).json({ success: false, message: 'Invalid join code' });
    }

    if (!space.inviteEnabled) {
      return res.status(403).json({ success: false, message: 'Invites are currently disabled for this space' });
    }

    // Check if already a member
    const existingMembership = await Membership.findOne({
      spaceId: space._id,
      userId: req.user.id
    });

    if (existingMembership) {
      return res.status(400).json({ success: false, message: 'You are already a member of this space' });
    }

    // Join space
    await Membership.create({
      spaceId: space._id,
      userId: req.user.id,
      role: 'member',
    });

    const membersCount = await Membership.countDocuments({ spaceId: space._id });
    const spaceData = space.toObject();
    spaceData.membersCount = membersCount;
    spaceData.userRole = 'member';

    res.status(200).json({
      success: true,
      message: `Successfully joined ${space.name}`,
      space: spaceData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single space details (if member)
// @route   GET /api/spaces/:id
// @access  Private
const getSpace = async (req, res, next) => {
  try {
    // Check membership
    const membership = await Membership.findOne({ spaceId: req.params.id, userId: req.user.id });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this space' });
    }

    const space = await StudySpace.findById(req.params.id);
    const membersCount = await Membership.countDocuments({ spaceId: space._id });
    
    const spaceData = space.toObject();
    spaceData.membersCount = membersCount;
    spaceData.userRole = membership.role;

    res.status(200).json({
      success: true,
      space: spaceData
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
    // Check ownership
    const membership = await Membership.findOne({ spaceId: req.params.id, userId: req.user.id });
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the space owner can update settings' });
    }

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

    const space = await StudySpace.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

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
    // Check ownership
    const membership = await Membership.findOne({ spaceId: req.params.id, userId: req.user.id });
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the space owner can delete this space' });
    }

    const space = await StudySpace.findById(req.params.id);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Delete all related data (messages, memberships, then the space itself)
    await Message.deleteMany({ spaceId: space._id });
    await Membership.deleteMany({ spaceId: space._id });
    await StudySpace.findByIdAndDelete(space._id);

    res.status(200).json({
      success: true,
      message: 'Study space and all related data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSpace,
  getSpaces,
  joinSpace,
  getSpace,
  updateSpace,
  deleteSpace,
};
