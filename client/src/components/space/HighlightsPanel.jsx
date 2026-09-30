import React, { useCallback, useEffect, useState } from 'react';
import { Highlighter, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

// The study-oriented categories from PRD §16. Keeping the emoji alongside the
// colour makes a dense list scannable at a glance.
export const HIGHLIGHT_TYPES = [
  { id: 'exam-important', label: 'Exam important', emoji: '⭐', tint: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'important', label: 'Important', emoji: '❗', tint: 'bg-rose-50 text-rose-800 border-rose-200' },
  { id: 'doubt', label: 'Doubt', emoji: '❓', tint: 'bg-violet-50 text-violet-800 border-violet-200' },
  { id: 'solution', label: 'Solution', emoji: '✅', tint: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'reference', label: 'Reference', emoji: '🔗', tint: 'bg-blue-50 text-blue-800 border-blue-200' },
  { id: 'todo', label: 'To-do', emoji: '📝', tint: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const metaFor = (id) => HIGHLIGHT_TYPES.find((t) => t.id === id) || HIGHLIGHT_TYPES[5];

export default function HighlightsPanel({ spaceId, userRole, refreshKey }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [highlights, setHighlights] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadHighlights = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/highlights`);
      setHighlights(res.data.highlights);
      setCounts(res.data.counts);
    } catch (err) {
      console.error('Failed to load highlights', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadHighlights();
  }, [loadHighlights, refreshKey]);

  useEffect(() => {
    if (!socket) return;

    const handleAdded = (highlight) => {
      if (String(highlight.spaceId) !== String(spaceId)) return;
      setHighlights((prev) => (prev.some((h) => h._id === highlight._id) ? prev : [highlight, ...prev]));
      setCounts((prev) => ({ ...prev, [highlight.type]: (prev[highlight.type] || 0) + 1 }));
    };

    const handleRemoved = ({ highlightId }) => {
      setHighlights((prev) => {
        const gone = prev.find((h) => h._id === highlightId);
        if (gone) {
          setCounts((c) => ({ ...c, [gone.type]: Math.max((c[gone.type] || 1) - 1, 0) }));
        }
        return prev.filter((h) => h._id !== highlightId);
      });
    };

    socket.on('highlight_added', handleAdded);
    socket.on('highlight_removed', handleRemoved);
    return () => {
      socket.off('highlight_added', handleAdded);
      socket.off('highlight_removed', handleRemoved);
    };
  }, [socket, spaceId]);

  const handleDelete = async (highlight) => {
    setBusyId(highlight._id);
    try {
      await api.delete(`/spaces/${spaceId}/highlights/${highlight._id}`);
      setHighlights((prev) => prev.filter((h) => h._id !== highlight._id));
      setCounts((prev) => ({ ...prev, [highlight.type]: Math.max((prev[highlight.type] || 1) - 1, 0) }));
      toast.success('Highlight removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove highlight');
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter ? highlights.filter((h) => h.type === filter) : highlights;

  return (
    <div className="flex flex-col h-full bg-surface rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Highlighter size={15} /> Highlights
        </h3>
        <span className="text-xs text-gray-400">{highlights.length}</span>
      </div>

      {/* Filter by category — the reason highlights are typed at all */}
      <div className="px-3 py-2 border-b flex gap-1 overflow-x-auto shrink-0">
        <button
          onClick={() => setFilter('')}
          className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
            filter === '' ? 'bg-ink text-paper' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {HIGHLIGHT_TYPES.filter((t) => counts[t.id]).map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(filter === t.id ? '' : t.id)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              filter === t.id ? 'bg-ink text-paper' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.emoji} {t.label} {counts[t.id]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading highlights...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <Highlighter size={22} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">
              {filter ? 'Nothing in this category' : 'No highlights yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Select text in the shared notes and mark it, or highlight a message
              from the discussion.
            </p>
          </div>
        ) : (
          visible.map((highlight) => {
            const meta = metaFor(highlight.type);
            const canDelete = String(highlight.createdBy) === String(user.id) || userRole === 'owner';

            return (
              <div
                key={highlight._id}
                className={`group border rounded-lg p-3 transition-all hover:shadow-sm ${meta.tint}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                    {meta.emoji} {meta.label}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(highlight)}
                      disabled={busyId === highlight._id}
                      className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus:opacity-100 hover:text-rose-700 p-0.5 rounded transition-all disabled:opacity-50 shrink-0"
                      title="Remove highlight"
                    >
                      {busyId === highlight._id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-sm mt-1.5 leading-relaxed">{highlight.label}</p>

                <p className="text-[10px] opacity-60 mt-1.5">
                  from {highlight.sourceType === 'notes' ? 'shared notes' : highlight.sourceType} ·{' '}
                  {highlight.createdByName} · {new Date(highlight.createdAt).toLocaleDateString()}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
