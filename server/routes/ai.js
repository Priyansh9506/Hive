const express = require('express');
const {
  summarizeDiscussion,
  generateQuiz,
  explainContent,
  generateRevisionNotes,
  askStudySpace,
} = require('../controllers/aiController');
const { requireMember } = require('../middleware/space');
const { aiLimiter } = require('../middleware/rateLimiter');

// Mounted by routes/spaces.js at `/:spaceId/ai`, after its `protect`, so
// `mergeParams` is what exposes `:spaceId` here.
const router = express.Router({ mergeParams: true });

// Membership first, so non-members are turned away without spending AI quota
router.use(requireMember);
router.use(aiLimiter);

router.post('/summarize', summarizeDiscussion);
router.post('/quiz', generateQuiz);
router.post('/explain', explainContent);
router.post('/revision-notes', generateRevisionNotes);
router.post('/ask', askStudySpace);

module.exports = router;
