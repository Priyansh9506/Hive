const express = require('express');
const {
  createSpace,
  getSpaces,
  joinSpace,
  previewInvite,
  getSpace,
  updateSpace,
  deleteSpace,
  updateNotes,
} = require('../controllers/spaceController');
const { getMessages, updateMessage, deleteMessage, markRead } = require('../controllers/messageController');
const { getMembers, leaveSpace, removeMember } = require('../controllers/memberController');
const {
  getInvite,
  updateInvite,
  regenerateInvite,
  sendEmailInvite,
} = require('../controllers/inviteController');
const { getResources, createResource, deleteResource } = require('../controllers/resourceController');
const { getPins, createPin, deletePin } = require('../controllers/pinController');
const {
  getHighlights,
  createHighlight,
  deleteHighlight,
} = require('../controllers/highlightController');
const { getActivity } = require('../controllers/activityController');
const { getVersions, getVersion, restoreVersion } = require('../controllers/snapshotController');
const { protect } = require('../middleware/auth');
const { requireMember, requireOwner } = require('../middleware/space');
const { apiLimiter, uploadLimiter, emailLimiter } = require('../middleware/rateLimiter');
const { uploadSingle } = require('../middleware/upload');
const { validate, spaceRules, resourceRules, pinRules, highlightRules } = require('../middleware/validate');

const router = express.Router();

// Apply auth protect and rate limiting to all space routes
router.use(protect);
router.use(apiLimiter);

// ---------- Collection-level ----------
router.route('/')
  .post(spaceRules, validate, createSpace)
  .get(getSpaces);

router.post('/join', joinSpace);
router.get('/invite/:code', previewInvite);

// ---------- Single space ----------
// requireMember loads the caller's membership onto the request; requireOwner
// then checks its role. Both run before the controller, so controllers never
// re-query authorization.
router.route('/:id')
  .get(requireMember, getSpace)
  .patch(requireMember, requireOwner, updateSpace)
  .delete(requireMember, requireOwner, deleteSpace);

router.patch('/:id/notes', requireMember, updateNotes);

// ---------- Members ----------
router.get('/:spaceId/members', requireMember, getMembers);
router.post('/:spaceId/leave', requireMember, leaveSpace);
router.delete('/:spaceId/members/:userId', requireMember, requireOwner, removeMember);

// ---------- Invites ----------
router.route('/:spaceId/invites')
  .get(requireMember, getInvite)
  .post(requireMember, requireOwner, updateInvite);
router.post('/:spaceId/invites/regenerate', requireMember, requireOwner, regenerateInvite);
router.post('/:spaceId/invites/email', requireMember, emailLimiter, sendEmailInvite);

// ---------- Messages ----------
router.get('/:spaceId/messages', requireMember, getMessages);
router.post('/:spaceId/read', requireMember, markRead);
router.route('/:spaceId/messages/:messageId')
  .patch(requireMember, updateMessage)
  .delete(requireMember, deleteMessage);

// ---------- Resources ----------
// `uploadSingle` must run before validation so multipart fields are parsed into
// req.body; it is a no-op for JSON requests (links and code snippets).
router.route('/:spaceId/resources')
  .get(requireMember, getResources)
  .post(requireMember, uploadLimiter, uploadSingle('file'), resourceRules, validate, createResource);
router.delete('/:spaceId/resources/:resourceId', requireMember, deleteResource);

// ---------- Pins ----------
router.route('/:spaceId/pins')
  .get(requireMember, getPins)
  .post(requireMember, pinRules, validate, createPin);
router.delete('/:spaceId/pins/:pinId', requireMember, deletePin);

// ---------- Highlights ----------
router.route('/:spaceId/highlights')
  .get(requireMember, getHighlights)
  .post(requireMember, highlightRules, validate, createHighlight);
router.delete('/:spaceId/highlights/:highlightId', requireMember, deleteHighlight);

// ---------- Activity feed ----------
router.get('/:spaceId/activity', requireMember, getActivity);

// ---------- Document versions ----------
router.get('/:spaceId/versions', requireMember, getVersions);
router.get('/:spaceId/versions/:version', requireMember, getVersion);
// Any member may restore: members can already edit the notes, and a restore is
// itself undoable by restoring the version saved just before it.
router.post('/:spaceId/versions/:version/restore', requireMember, restoreVersion);

module.exports = router;
