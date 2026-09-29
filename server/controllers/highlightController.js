const Highlight = require('../models/Highlight');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const logActivity = require('../utils/logActivity');
const { getIo } = require('../config/socket');

const HIGHLIGHT_TYPES = ['important', 'exam-important', 'doubt', 'solution', 'reference', 'todo'];

// @desc    List highlights in a space, optionally filtered by type
// @route   GET /api/spaces/:spaceId/highlights?type=exam-important
// @access  Private (Member only)
const getHighlights = async (req, res, next) => {
  try {
    const query = { spaceId: req.spaceId };

    if (req.query.type) {
      if (!HIGHLIGHT_TYPES.includes(req.query.type)) {
        return res.status(400).json({
          success: false,
          message: `type must be one of: ${HIGHLIGHT_TYPES.join(', ')}`,
        });
      }
      query.type = req.query.type;
    }

    const highlights = await Highlight.find(query).sort({ createdAt: -1 }).lean();

    // Counts per type so the filter bar can show them without a second request.
    // $match needs a real ObjectId (no schema casting in the aggregation
    // pipeline), which is what the membership already holds.
    const grouped = await Highlight.aggregate([
      { $match: { spaceId: req.membership.spaceId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(grouped.map((g) => [g._id, g.count]));

    res.status(200).json({
      success: true,
      count: highlights.length,
      counts,
      highlights,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a highlight on a message, resource, or notes selection
// @route   POST /api/spaces/:spaceId/highlights
// @access  Private (Member only)
const createHighlight = async (req, res, next) => {
  try {
    const { sourceType, sourceId, type, label } = req.body;

    if (!['message', 'resource', 'notes'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        message: 'sourceType must be one of: message, resource, notes',
      });
    }

    if (!HIGHLIGHT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${HIGHLIGHT_TYPES.join(', ')}`,
      });
    }

    let text = String(label || '').trim();

    // Confirm the source belongs to this space, and fall back to its own text
    if (sourceType === 'message') {
      const message = await Message.findOne({ _id: sourceId, spaceId: req.spaceId });
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found in this space' });
      }
      text = text || message.content;
    } else if (sourceType === 'resource') {
      const resource = await Resource.findOne({ _id: sourceId, spaceId: req.spaceId });
      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found in this space' });
      }
      text = text || resource.title;
    }

    if (!text) {
      return res.status(400).json({ success: false, message: 'Please provide the text to highlight' });
    }

    const highlight = await Highlight.create({
      spaceId: req.spaceId,
      sourceType,
      // A notes highlight is the selected text itself, with no row to point at
      sourceId: sourceType === 'notes' ? null : sourceId,
      type,
      label: text.slice(0, 2000),
      createdBy: req.user.id,
      createdByName: req.user.name,
    });

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'highlight_created',
      summary: `marked something as ${type.replace('-', ' ')}`,
      targetType: 'highlight',
      targetId: highlight._id,
    });

    getIo().to(`space:${req.spaceId}`).emit('highlight_added', highlight.toObject());

    res.status(201).json({ success: true, highlight });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a highlight
// @route   DELETE /api/spaces/:spaceId/highlights/:highlightId
// @access  Private (Creator or space owner)
const deleteHighlight = async (req, res, next) => {
  try {
    const highlight = await Highlight.findOne({
      _id: req.params.highlightId,
      spaceId: req.spaceId,
    });

    if (!highlight) {
      return res.status(404).json({ success: false, message: 'Highlight not found' });
    }

    const isCreator = String(highlight.createdBy) === String(req.user.id);
    if (!isCreator && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the person who created this highlight, or the space owner, can remove it',
      });
    }

    await Highlight.deleteOne({ _id: highlight._id });

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'highlight_deleted',
      summary: 'removed a highlight',
      targetType: 'highlight',
      targetId: highlight._id,
    });

    getIo().to(`space:${req.spaceId}`).emit('highlight_removed', {
      spaceId: req.spaceId,
      highlightId: highlight._id,
    });

    res.status(200).json({ success: true, message: 'Highlight removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHighlights, createHighlight, deleteHighlight, HIGHLIGHT_TYPES };
