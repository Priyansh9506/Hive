const Pin = require('../models/Pin');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const logActivity = require('../utils/logActivity');
const { getIo } = require('../config/socket');

// A pin stores a snapshot of what was pinned so the panel still reads correctly
// after the source is edited. Keep it short enough to scan in a list.
const summarise = (text, max = 160) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// @desc    List pinned items in a space
// @route   GET /api/spaces/:spaceId/pins
// @access  Private (Member only)
const getPins = async (req, res, next) => {
  try {
    const pins = await Pin.find({ spaceId: req.spaceId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      count: pins.length,
      pins,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pin a message, resource, or free-text announcement
// @route   POST /api/spaces/:spaceId/pins
// @access  Private (Member only)
const createPin = async (req, res, next) => {
  try {
    const { sourceType, sourceId, label } = req.body;

    if (!['message', 'resource', 'note', 'announcement'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        message: 'sourceType must be one of: message, resource, note, announcement',
      });
    }

    let pinLabel = summarise(label);

    // Resolve the source so the pin cannot reference content from another space,
    // and so the label can be filled in from the source when not supplied.
    if (sourceType === 'message') {
      const message = await Message.findOne({ _id: sourceId, spaceId: req.spaceId });
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found in this space' });
      }
      pinLabel = pinLabel || summarise(message.content);
    } else if (sourceType === 'resource') {
      const resource = await Resource.findOne({ _id: sourceId, spaceId: req.spaceId });
      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found in this space' });
      }
      pinLabel = pinLabel || summarise(resource.title);
    } else if (!pinLabel) {
      // `note` and `announcement` pins are only their text
      return res.status(400).json({ success: false, message: 'Please provide the text to pin' });
    }

    const needsSource = sourceType === 'message' || sourceType === 'resource';
    if (needsSource && !sourceId) {
      return res.status(400).json({ success: false, message: 'sourceId is required for this pin type' });
    }

    let pin;
    try {
      pin = await Pin.create({
        spaceId: req.spaceId,
        sourceType,
        sourceId: needsSource ? sourceId : null,
        label: pinLabel,
        pinnedBy: req.user.id,
        pinnedByName: req.user.name,
      });
    } catch (err) {
      // Unique index on (spaceId, sourceType, sourceId)
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'That item is already pinned' });
      }
      throw err;
    }

    // Mirror onto the source so chat and the library can show the badge without
    // querying the pins collection
    if (sourceType === 'message') {
      await Message.updateOne({ _id: sourceId }, { isPinned: true });
    } else if (sourceType === 'resource') {
      await Resource.updateOne({ _id: sourceId }, { isPinned: true });
    }

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'message_pinned',
      summary: `pinned "${summarise(pinLabel, 60)}"`,
      targetType: sourceType === 'resource' ? 'resource' : 'message',
      targetId: needsSource ? sourceId : null,
    });

    getIo().to(`space:${req.spaceId}`).emit('pin_added', pin.toObject());

    res.status(201).json({ success: true, pin });
  } catch (error) {
    next(error);
  }
};

// @desc    Unpin an item
// @route   DELETE /api/spaces/:spaceId/pins/:pinId
// @access  Private (Pinner or space owner)
const deletePin = async (req, res, next) => {
  try {
    const pin = await Pin.findOne({ _id: req.params.pinId, spaceId: req.spaceId });

    if (!pin) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }

    // Unpinning global content is an owner right (PRD §22); otherwise you can
    // only remove your own pin.
    const isPinner = String(pin.pinnedBy) === String(req.user.id);
    if (!isPinner && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the person who pinned this, or the space owner, can unpin it',
      });
    }

    await Pin.deleteOne({ _id: pin._id });

    if (pin.sourceType === 'message' && pin.sourceId) {
      await Message.updateOne({ _id: pin.sourceId }, { isPinned: false });
    } else if (pin.sourceType === 'resource' && pin.sourceId) {
      await Resource.updateOne({ _id: pin.sourceId }, { isPinned: false });
    }

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'message_unpinned',
      summary: `unpinned "${summarise(pin.label, 60)}"`,
      targetType: pin.sourceType === 'resource' ? 'resource' : 'message',
      targetId: pin.sourceId,
    });

    getIo().to(`space:${req.spaceId}`).emit('pin_removed', {
      spaceId: req.spaceId,
      pinId: pin._id,
      sourceType: pin.sourceType,
      sourceId: pin.sourceId,
    });

    res.status(200).json({ success: true, message: 'Unpinned' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPins, createPin, deletePin };
