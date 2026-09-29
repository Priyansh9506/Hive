const Message = require('../models/Message');
const StudySpace = require('../models/StudySpace');
const { getNotesText } = require('../config/yjs');
const gemini = require('../services/geminiService');

// How much recent chat a summary covers when the client sends none
const DEFAULT_SUMMARY_MESSAGES = 50;
const MAX_SUMMARY_MESSAGES = 200;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

// @desc    Summarize recent chat as bullet points
// @route   POST /api/spaces/:spaceId/ai/summarize
// @body    { messages?: string[] } — omit to summarize the space's latest messages
// @access  Private (Member only)
const summarizeDiscussion = async (req, res, next) => {
  try {
    let { messages } = req.body;

    if (messages !== undefined) {
      if (!Array.isArray(messages) || !messages.every((m) => typeof m === 'string')) {
        return res.status(400).json({ success: false, message: 'messages must be an array of strings' });
      }
      if (messages.length > MAX_SUMMARY_MESSAGES) {
        return res.status(400).json({
          success: false,
          message: `You can summarize at most ${MAX_SUMMARY_MESSAGES} messages at a time`,
        });
      }
    } else {
      const recent = await Message.find({ spaceId: req.spaceId, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(DEFAULT_SUMMARY_MESSAGES)
        .select('senderName content')
        .lean();
      messages = recent.reverse().map((m) => `${m.senderName}: ${m.content}`);
    }

    if (!messages.some(isNonEmptyString)) {
      return res.status(400).json({ success: false, message: 'There are no messages to summarize yet' });
    }

    const summary = await gemini.summarizeDiscussion(messages);

    res.status(200).json({
      success: true,
      data: { summary, messageCount: messages.length },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate a 5-question multiple-choice quiz
// @route   POST /api/spaces/:spaceId/ai/quiz
// @body    { notes?: string } — omit to quiz on the space's shared notes
// @access  Private (Member only)
const generateQuiz = async (req, res, next) => {
  try {
    const { notes } = req.body;

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ success: false, message: 'notes must be a string' });
    }

    const source = isNonEmptyString(notes) ? notes : await getNotesText(req.spaceId);
    const quiz = await gemini.generateQuiz(source);

    res.status(200).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
};

// @desc    Explain a highlighted concept in simple terms
// @route   POST /api/spaces/:spaceId/ai/explain
// @body    { text: string, context?: string }
// @access  Private (Member only)
const explainContent = async (req, res, next) => {
  try {
    const { text, context } = req.body;

    if (!isNonEmptyString(text)) {
      return res.status(400).json({ success: false, message: 'Please provide the text to explain' });
    }
    if (context !== undefined && typeof context !== 'string') {
      return res.status(400).json({ success: false, message: 'context must be a string' });
    }

    const explanation = await gemini.explainContent(text, context);

    res.status(200).json({ success: true, data: { explanation } });
  } catch (error) {
    next(error);
  }
};

// @desc    Turn raw text into structured markdown revision notes
// @route   POST /api/spaces/:spaceId/ai/revision-notes
// @body    { text?: string } — omit to use the space's shared notes
// @access  Private (Member only)
const generateRevisionNotes = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (text !== undefined && typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'text must be a string' });
    }

    const source = isNonEmptyString(text) ? text : await getNotesText(req.spaceId);
    const notes = await gemini.generateRevisionNotes(source);

    res.status(200).json({ success: true, data: { notes } });
  } catch (error) {
    next(error);
  }
};

// @desc    Answer a question using the space's shared notes as context
// @route   POST /api/spaces/:spaceId/ai/ask
// @body    { question: string }
// @access  Private (Member only)
const askStudySpace = async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!isNonEmptyString(question)) {
      return res.status(400).json({ success: false, message: 'Please enter a question' });
    }

    const [notes, space] = await Promise.all([
      getNotesText(req.spaceId),
      StudySpace.findById(req.spaceId).select('name').lean(),
    ]);

    const answer = await gemini.askStudySpace(question, notes, space?.name);

    res.status(200).json({
      success: true,
      data: { question: question.trim(), answer, usedNotes: notes.trim().length > 0 },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  summarizeDiscussion,
  generateQuiz,
  explainContent,
  generateRevisionNotes,
  askStudySpace,
};
