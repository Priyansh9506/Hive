import api from './api';

// Gemini can take a while, and a busy main model hands over to a fallback
// (up to two 30s attempts server-side), so allow more than that here.
const AI_TIMEOUT_MS = 75 * 1000;

const post = async (spaceId, path, body = {}) => {
  const res = await api.post(`/spaces/${spaceId}/ai/${path}`, body, { timeout: AI_TIMEOUT_MS });
  return res.data.data;
};

// Endpoints from server/routes/ai.js. Omitted text falls back to the space's
// shared notes (quiz, revision notes) or its latest messages (summarize).
export const aiApi = {
  ask: (spaceId, question) => post(spaceId, 'ask', { question }),
  summarize: (spaceId, messages) => post(spaceId, 'summarize', messages ? { messages } : {}),
  quiz: (spaceId, notes) => post(spaceId, 'quiz', notes ? { notes } : {}),
  explain: (spaceId, text, context) => post(spaceId, 'explain', { text, context }),
  revisionNotes: (spaceId, text) => post(spaceId, 'revision-notes', text ? { text } : {}),
};

export const aiErrorMessage = (err) => {
  if (err.code === 'ECONNABORTED') return 'The AI assistant took too long to respond. Please try again.';
  return err.response?.data?.message || 'The AI assistant is unavailable right now. Please try again.';
};
