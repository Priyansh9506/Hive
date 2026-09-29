import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { HIGHLIGHT_TYPES } from './HighlightsPanel';
import api from '../../lib/api';

/**
 * Turns a piece of content into a categorised highlight.
 *
 * `target` is `{ sourceType, sourceId, text }` — a notes selection has no
 * sourceId, a message or resource highlight carries one.
 */
export default function HighlightModal({ isOpen, onClose, spaceId, target, onCreated }) {
  const [type, setType] = useState('exam-important');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the editable text from whatever was selected
  useEffect(() => {
    if (isOpen) {
      setText(target?.text || '');
      setType('exam-important');
    }
  }, [isOpen, target]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return toast.error('There is nothing to highlight');

    setSaving(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/highlights`, {
        sourceType: target?.sourceType || 'notes',
        sourceId: target?.sourceId,
        type,
        label: text.trim(),
      });
      onCreated?.(res.data.highlight);
      toast.success('Highlight saved');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save highlight');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Mark as a highlight">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="grid grid-cols-2 gap-2">
            {HIGHLIGHT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                disabled={saving}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  type === t.id ? `${t.tint} border-current` : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>{t.emoji}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="highlightText">Text</Label>
          <textarea
            id="highlightText"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving}
            maxLength={2000}
            placeholder="What is worth remembering here?"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11px] text-gray-400">
            From {target?.sourceType === 'message' ? 'the discussion' : target?.sourceType === 'resource' ? 'a resource' : 'the shared notes'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !text.trim()}>
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {saving ? 'Saving...' : 'Save highlight'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
