const Membership = require('../models/Membership');
const StudySpace = require('../models/StudySpace');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const Pin = require('../models/Pin');
const Highlight = require('../models/Highlight');

// Escape regex metacharacters so a query like "C++" or "a.b" searches literally
// instead of erroring or matching far too much.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Search across the spaces the user belongs to (PRD §23)
// @route   GET /api/search?q=normalization&spaceId=<optional>&limit=10
// @access  Private
const search = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 25);

    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter at least 2 characters to search',
      });
    }

    // Search is always scoped to the caller's memberships — never the whole DB
    const memberships = await Membership.find({ userId: req.user.id }).select('spaceId').lean();
    let spaceIds = memberships.map((m) => m.spaceId);

    // Optionally narrow to one space, but only one they actually belong to
    if (req.query.spaceId) {
      const requested = String(req.query.spaceId);
      if (!spaceIds.some((id) => String(id) === requested)) {
        return res.status(403).json({ success: false, message: 'Not a member of that space' });
      }
      spaceIds = spaceIds.filter((id) => String(id) === requested);
    }

    if (spaceIds.length === 0) {
      return res.status(200).json({
        success: true,
        query: q,
        total: 0,
        results: { spaces: [], messages: [], resources: [], pins: [], highlights: [] },
      });
    }

    // Substring matching rather than $text: a study group searching
    // "normal" should find "normalization", which stemmed text search misses.
    const rx = new RegExp(escapeRegex(q), 'i');
    const inSpaces = { spaceId: { $in: spaceIds } };

    const [spaces, messages, resources, pins, highlights] = await Promise.all([
      StudySpace.find({ _id: { $in: spaceIds }, $or: [{ name: rx }, { description: rx }] })
        .select('name description icon color joinCode')
        .limit(limit)
        .lean(),

      Message.find({ ...inSpaces, content: rx, deletedAt: null })
        .select('spaceId senderName content createdAt isPinned')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Resource.find({ ...inSpaces, $or: [{ title: rx }, { description: rx }] })
        .select('spaceId title description type url uploadedByName createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Pin.find({ ...inSpaces, label: rx })
        .select('spaceId sourceType sourceId label pinnedByName createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Highlight.find({ ...inSpaces, label: rx })
        .select('spaceId sourceType sourceId type label createdByName createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    // Attach space names so results are readable outside their workspace
    const spaceNames = new Map(
      (await StudySpace.find({ _id: { $in: spaceIds } }).select('name').lean()).map((s) => [
        String(s._id),
        s.name,
      ])
    );
    const withSpaceName = (rows) =>
      rows.map((r) => ({ ...r, spaceName: spaceNames.get(String(r.spaceId)) || 'Unknown space' }));

    const results = {
      spaces,
      messages: withSpaceName(messages),
      resources: withSpaceName(resources),
      pins: withSpaceName(pins),
      highlights: withSpaceName(highlights),
    };

    res.status(200).json({
      success: true,
      query: q,
      total: Object.values(results).reduce((sum, rows) => sum + rows.length, 0),
      results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { search };
