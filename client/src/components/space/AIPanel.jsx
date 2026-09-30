import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles, MessageCircleQuestion, ListChecks, GraduationCap, Lightbulb, NotebookPen,
  SendHorizontal, Loader2, Copy, Check, RotateCcw, Trash2, CircleCheck, CircleX, CircleAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import Markdown from '../ui/Markdown';
import { aiApi, aiErrorMessage } from '../../lib/ai';
import Reveal from '../motion/Reveal';
import { useReveal } from '../../hooks/useReveal';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';

const TOOLS = [
  { id: 'ask', label: 'Ask', icon: MessageCircleQuestion },
  { id: 'summarize', label: 'Summarize', icon: ListChecks },
  { id: 'quiz', label: 'Quiz', icon: GraduationCap },
  { id: 'explain', label: 'Explain', icon: Lightbulb },
  { id: 'revision', label: 'Revision notes', icon: NotebookPen },
];

const timeOf = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Runs one AI request at a time and keeps its result, loading and error state.
 * Every tool follows the same request → result shape, so they share this.
 */
function useAiRequest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (request) => {
    setLoading(true);
    setError('');
    try {
      const data = await request();
      setResult({ ...data, at: new Date() });
      return data;
    } catch (err) {
      setError(aiErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError('');
  }, []);

  return { result, loading, error, run, reset };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  return (
    <button
      onClick={copy}
      className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100"
      title="Copy as markdown"
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Thinking({ label = 'Thinking...' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
      <Loader2 size={15} className="animate-spin text-violet-500" />
      <span>{label}</span>
      <span className="text-xs text-gray-400">This can take up to a minute.</span>
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <Reveal y={6} className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
      <CircleAlert size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </Reveal>
  );
}

function ResultCard({ title, meta, markdown }) {
  return (
    <Reveal className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 border-b">
        <div className="text-xs text-gray-500 truncate">
          <span className="font-semibold text-gray-700">{title}</span>
          {meta && <span> · {meta}</span>}
        </div>
        <CopyButton text={markdown} />
      </div>
      <div className="p-4">
        <Markdown>{markdown}</Markdown>
      </div>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------

function AskTool({ spaceId }) {
  const [thread, setThread] = useState([]); // { id, question, answer?, usedNotes?, error? }
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const threadRef = useRef(null);

  // Each question, answer and error eases in as it is added to the conversation
  useReveal(threadRef, { selector: '[data-reveal]', deps: [thread], y: 10 });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread, loading]);

  const ask = async () => {
    const text = question.trim();
    if (!text || loading) return;

    const id = Date.now();
    setThread((prev) => [...prev, { id, question: text }]);
    setQuestion('');
    setLoading(true);
    try {
      const data = await aiApi.ask(spaceId, text);
      setThread((prev) => prev.map((t) => (t.id === id ? { ...t, answer: data.answer, usedNotes: data.usedNotes } : t)));
    } catch (err) {
      setThread((prev) => prev.map((t) => (t.id === id ? { ...t, error: aiErrorMessage(err) } : t)));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full px-6 py-10">
            <MessageCircleQuestion size={26} className="text-violet-300 mb-2" />
            <p className="text-sm font-medium text-gray-600">Ask anything about this space</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Answers are based on the shared notes. If the notes don't cover your question, the assistant says so
              and labels any general answer.
            </p>
          </div>
        ) : (
          thread.map((t) => (
            <div key={t.id} className="space-y-2">
              <div data-reveal className="flex justify-end">
                <p className="max-w-[85%] bg-flame text-flame-ink text-sm rounded-2xl rounded-br-sm px-3.5 py-2 whitespace-pre-wrap">
                  {t.question}
                </p>
              </div>
              {t.answer && (
                <div data-reveal className="max-w-[95%] bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Markdown>{t.answer}</Markdown>
                  {!t.usedNotes && (
                    <p className="text-[11px] text-gray-400 mt-2">The shared notes are empty, so this is a general answer.</p>
                  )}
                </div>
              )}
              {t.error && <ErrorNote message={t.error} />}
            </div>
          ))
        )}
        {loading && <Thinking />}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3 flex items-end gap-2 shrink-0 bg-surface">
        {thread.length > 0 && (
          <button
            onClick={() => setThread([])}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 disabled:opacity-40"
            title="Clear conversation"
          >
            <Trash2 size={16} />
          </button>
        )}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={1000}
          placeholder="e.g. What's the difference between mitosis and meiosis?"
          className="flex-1 resize-none text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 max-h-32"
        />
        <Button size="sm" onClick={ask} disabled={!question.trim() || loading} className="bg-violet-600! hover:opacity-90 text-white">
          <SendHorizontal size={15} />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

function SummarizeTool({ spaceId }) {
  const { result, loading, error, run } = useAiRequest();

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Get the key points, decisions and open questions from the last 50 messages in the discussion.
        </p>
        <Button size="sm" onClick={() => run(() => aiApi.summarize(spaceId))} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ListChecks size={14} className="mr-1.5" />}
          {result ? 'Summarize again' : 'Summarize discussion'}
        </Button>
      </div>
      {loading && <Thinking label="Reading the discussion..." />}
      <ErrorNote message={error} />
      {result && !loading && (
        <ResultCard
          title="Discussion summary"
          meta={`${result.messageCount} messages · ${timeOf(result.at)}`}
          markdown={result.summary}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

function QuizQuestion({ index, question, chosen, onChoose }) {
  const answered = chosen !== undefined;
  const cardRef = useRef(null);

  // Answering gets physical feedback: a small pop when right, a shake when wrong
  useGSAP(
    () => {
      if (!answered || prefersReducedMotion()) return;
      const option = cardRef.current.querySelector(`[data-option="${chosen}"]`);
      if (chosen === question.answerIndex) {
        gsap.fromTo(option, { scale: 1 }, { scale: 1.03, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
      } else {
        gsap.fromTo(option, { x: 0 }, { keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.4, ease: 'power1.inOut', clearProps: 'transform' });
      }
    },
    { dependencies: [chosen], scope: cardRef }
  );

  return (
    <div ref={cardRef} data-quiz-question className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">
        {index + 1}. {question.question}
      </p>
      <div className="space-y-2">
        {question.options.map((option, i) => {
          const isAnswer = i === question.answerIndex;
          const isChosen = i === chosen;
          let tone = 'border-gray-200 hover:border-violet-300 hover:bg-violet-50';
          if (answered) {
            if (isAnswer) tone = 'border-emerald-300 bg-emerald-50 text-emerald-900';
            else if (isChosen) tone = 'border-rose-300 bg-rose-50 text-rose-900';
            else tone = 'border-gray-200 opacity-60';
          }
          return (
            <button
              key={i}
              data-option={i}
              onClick={() => onChoose(i)}
              disabled={answered}
              className={`w-full text-left text-sm border rounded-lg px-3 py-2 flex items-start gap-2 transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="font-semibold text-gray-400 w-4 shrink-0">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{option}</span>
              {answered && isAnswer && <CircleCheck size={16} className="text-emerald-600 shrink-0" />}
              {answered && isChosen && !isAnswer && <CircleX size={16} className="text-rose-600 shrink-0" />}
            </button>
          );
        })}
      </div>
      {answered && question.explanation && (
        <Reveal y={6} className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 mt-3 leading-relaxed">
          <span className="font-semibold">{chosen === question.answerIndex ? 'Correct. ' : 'Not quite. '}</span>
          {question.explanation}
        </Reveal>
      )}
    </div>
  );
}

function QuizTool({ spaceId }) {
  const { result: quiz, loading, error, run, reset } = useAiRequest();
  const [source, setSource] = useState('notes'); // 'notes' | 'custom'
  const [customText, setCustomText] = useState('');
  const [answers, setAnswers] = useState({}); // question index -> chosen option
  const quizRef = useRef(null);

  // A fresh quiz deals its questions in one after another
  useReveal(quizRef, { selector: '[data-quiz-question]', deps: [quiz, loading], y: 16, stagger: 0.08 });

  const generate = async () => {
    const data = await run(() => aiApi.quiz(spaceId, source === 'custom' ? customText : undefined));
    if (data) setAnswers({});
  };

  if (quiz && !loading) {
    const answeredCount = Object.keys(answers).length;
    const score = quiz.questions.filter((q, i) => answers[i] === q.answerIndex).length;
    const done = answeredCount === quiz.questions.length;

    return (
      <div ref={quizRef} className="p-4 space-y-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-gray-900">{quiz.title}</h4>
            <p className="text-xs text-gray-500">
              {done ? `You scored ${score} of ${quiz.questions.length}` : `${answeredCount} of ${quiz.questions.length} answered`}
            </p>
          </div>
          <div className="flex gap-2">
            {answeredCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => setAnswers({})}>
                <RotateCcw size={13} className="mr-1.5" /> Retry
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { reset(); setAnswers({}); }}>
              New quiz
            </Button>
          </div>
        </div>

        {done && (
          <Reveal className={`text-sm rounded-lg px-4 py-3 border ${
            score === quiz.questions.length
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-violet-50 border-violet-200 text-violet-800'
          }`}>
            {score === quiz.questions.length
              ? 'Perfect score! You know this material well.'
              : 'Review the explanations above for the ones you missed, then retry.'}
          </Reveal>
        )}

        {quiz.questions.map((q, i) => (
          <QuizQuestion
            key={i}
            index={i}
            question={q}
            chosen={answers[i]}
            onChoose={(option) => setAnswers((prev) => ({ ...prev, [i]: option }))}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <p className="text-sm text-gray-600">Test yourself with a 5-question multiple-choice quiz.</p>

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs font-medium">
        {[
          { id: 'notes', label: 'From shared notes' },
          { id: 'custom', label: 'From my own text' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSource(opt.id)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              source === opt.id ? 'bg-surface shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {source === 'custom' && (
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          rows={8}
          placeholder="Paste the notes you want to be quizzed on..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
        />
      )}

      <Button
        size="sm"
        onClick={generate}
        disabled={loading || (source === 'custom' && customText.trim().length < 50)}
      >
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <GraduationCap size={14} className="mr-1.5" />}
        Generate quiz
      </Button>
      {source === 'custom' && customText.trim().length > 0 && customText.trim().length < 50 && (
        <p className="text-xs text-gray-400">Add a bit more text to build a quiz from.</p>
      )}

      {loading && <Thinking label="Writing questions..." />}
      <ErrorNote message={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explain
// ---------------------------------------------------------------------------

function ExplainTool({ spaceId, request, onRequestHandled }) {
  const { result, loading, error, run } = useAiRequest();
  const [text, setText] = useState('');
  const [context, setContext] = useState('');

  const explain = useCallback(
    (concept, surrounding) => run(() => aiApi.explain(spaceId, concept, surrounding || undefined)),
    [spaceId, run]
  );

  // "Explain" from the notes editor arrives as a request: show it in the box
  // straight away (during render, React's pattern for props-driven state)...
  const [shownRequest, setShownRequest] = useState(null);
  if (request && request !== shownRequest) {
    setShownRequest(request);
    setText(request.text);
    setContext(request.context || '');
  }

  // ...and send it
  useEffect(() => {
    if (!request) return;
    explain(request.text, request.context);
    onRequestHandled?.();
  }, [request, explain, onRequestHandled]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <p className="text-sm text-gray-600">
        Stuck on something? Get a simple explanation. Tip: select text in <span className="font-medium">Shared Notes</span> and
        click <span className="font-medium">Explain</span>.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setContext(''); }}
        rows={3}
        maxLength={2000}
        placeholder="e.g. Heisenberg's uncertainty principle"
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
      />
      <Button size="sm" onClick={() => explain(text.trim(), context)} disabled={!text.trim() || loading}>
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Lightbulb size={14} className="mr-1.5" />}
        Explain simply
      </Button>
      {loading && <Thinking label="Finding a simple way to put it..." />}
      <ErrorNote message={error} />
      {result && !loading && (
        <ResultCard title="Explanation" meta={timeOf(result.at)} markdown={result.explanation} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revision notes
// ---------------------------------------------------------------------------

function RevisionTool({ spaceId }) {
  const { result, loading, error, run } = useAiRequest();
  const [text, setText] = useState('');

  const usingNotes = !text.trim();

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <p className="text-sm text-gray-600">
        Turn lecture text, a textbook excerpt or rough notes into clean revision notes. Leave the box empty to use the
        space's shared notes.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste raw text here, or leave empty to use the shared notes..."
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
      />
      <Button size="sm" onClick={() => run(() => aiApi.revisionNotes(spaceId, text.trim() || undefined))} disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <NotebookPen size={14} className="mr-1.5" />}
        {usingNotes ? 'Create from shared notes' : 'Create revision notes'}
      </Button>
      {loading && <Thinking label="Organising the material..." />}
      <ErrorNote message={error} />
      {result && !loading && (
        <ResultCard title="Revision notes" meta={timeOf(result.at)} markdown={result.notes} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * The AI study assistant (Phase 2). Each tool keeps its own results while the
 * member switches between tools; the workspace keeps this panel mounted so
 * they also survive switching to other workspace tabs.
 */
export default function AIPanel({ spaceId, explainRequest, onExplainHandled }) {
  const [tool, setTool] = useState('ask');
  const toolsRef = useRef(null);
  const shownTool = useRef(tool);

  // Switching tools eases the newly shown one in
  useGSAP(
    () => {
      if (shownTool.current === tool) return;
      shownTool.current = tool;
      if (prefersReducedMotion()) return;
      const panel = toolsRef.current?.querySelector(':scope > :not(.hidden)');
      if (panel) gsap.fromTo(panel, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.25, overwrite: true, clearProps: 'transform,opacity,visibility' });
    },
    { dependencies: [tool] }
  );

  // A request from the editor always lands on the Explain tool
  const [seenRequest, setSeenRequest] = useState(null);
  if (explainRequest && explainRequest !== seenRequest) {
    setSeenRequest(explainRequest);
    setTool('explain');
  }

  return (
    <div className="flex flex-col h-full bg-surface rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0 gap-2">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Sparkles size={15} className="text-violet-500" /> AI Study Assistant
        </h3>
        <span className="text-[11px] text-gray-400 hidden sm:inline">Powered by Gemini · can make mistakes</span>
      </div>

      <div className="flex gap-1 px-2 py-2 border-b overflow-x-auto no-scrollbar shrink-0">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Every tool stays mounted so its input and results survive switching */}
      <div ref={toolsRef} className="flex-1 min-h-0">
        <div className={tool === 'ask' ? 'h-full' : 'hidden'}><AskTool spaceId={spaceId} /></div>
        <div className={tool === 'summarize' ? 'h-full' : 'hidden'}><SummarizeTool spaceId={spaceId} /></div>
        <div className={tool === 'quiz' ? 'h-full' : 'hidden'}><QuizTool spaceId={spaceId} /></div>
        <div className={tool === 'explain' ? 'h-full' : 'hidden'}>
          <ExplainTool spaceId={spaceId} request={explainRequest} onRequestHandled={onExplainHandled} />
        </div>
        <div className={tool === 'revision' ? 'h-full' : 'hidden'}><RevisionTool spaceId={spaceId} /></div>
      </div>
    </div>
  );
}
