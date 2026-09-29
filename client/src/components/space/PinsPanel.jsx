import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, MessageSquare, Paperclip, Pin, Plus, StickyNote, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

const SOURCE_META = {
  message: { icon: MessageSquare, label: 'Message', tint: 'text-blue-500 bg-blue-50' },
  resource: { icon: Paperclip, label: 'Resource', tint: 'text-emerald-600 bg-emerald-50' },
  note: { icon: StickyNote, label: 'Note', tint: 'text-violet-600 bg-violet-50' },
  announcement: { icon: Megaphone, label: 'Announcement', tint: 'text-amber-600 bg-amber-50' },
};

export default function PinsPanel({ spaceId, userRole, onJumpToMessage }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPins = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/pins`);
      setPins(res.data.pins);
    } catch (err) {
      console.error('Failed to load pins', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadPins();
  }, [loadPins]);

  useEffect(() => {
    if (!socket) return;

    const handleAdded = (pin) => {
      if (String(pin.spaceId) !== String(spaceId)) return;
      setPins((prev) => (prev.some((p) => p._id === pin._id) ? prev : [pin, ...prev]));
    };
    const handleRemoved = ({ pinId }) => setPins((prev) => prev.filter((p) => p._id !== pinId));

    socket.on('pin_added', handleAdded);
    socket.on('pin_removed', handleRemoved);
    return () => {
      socket.off('pin_added', handleAdded);
      socket.off('pin_removed', handleRemoved);
    };
  }, [socket, spaceId]);

  const handleUnpin = async (pin) => {
    setBusyId(pin._id);
    try {
      await api.delete(`/spaces/${spaceId}/pins/${pin._id}`);
      setPins((prev) => prev.filter((p) => p._id !== pin._id));
      toast.success('Unpinned');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unpin');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;

    setSaving(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/pins`, {
        sourceType: 'announcement',
        label: draft.trim(),
      });
      setPins((prev) => (prev.some((p) => p._id === res.data.pin._id) ? prev : [res.data.pin, ...prev]));
      setDraft('');
      setComposing(false);
      toast.success('Pinned');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Pin size={15} /> Pinned
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{pins.length}</span>
          <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => setComposing(!composing)}>
            {composing ? <X size={13} /> : <><Plus size={13} className="mr-1" /> Pin note</>}
          </Button>
        </div>
      </div>

      {composing && (
        <form onSubmit={handleAddAnnouncement} className="p-3 border-b bg-amber-50/50 space-y-2 shrink-0">
          <Input
            autoFocus
            placeholder="e.g., Final assignment due Friday 5pm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setComposing(false); setDraft(''); }} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !draft.trim()}>
              {saving && <Loader2 size={13} className="animate-spin mr-1.5" />} Pin it
            </Button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading pins...
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <Pin size={22} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">Nothing pinned yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Pin the messages and resources the group keeps coming back to, so they
              do not get buried.
            </p>
          </div>
        ) : (
          pins.map((pin, index) => {
            const { icon: Icon, label, tint } = SOURCE_META[pin.sourceType] || SOURCE_META.note;
            const canUnpin = String(pin.pinnedBy) === String(user.id) || userRole === 'owner';
            const jumpable = pin.sourceType === 'message' && pin.sourceId && onJumpToMessage;

            return (
              <div
                key={pin._id}
                className="group flex items-start gap-2.5 border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <span className="text-[11px] font-bold text-gray-300 tabular-nums mt-0.5 shrink-0">
                  {index + 1}
                </span>
                <span className={`p-1.5 rounded-md shrink-0 ${tint}`}>
                  <Icon size={13} />
                </span>

                <div className="min-w-0 flex-1">
                  {jumpable ? (
                    <button
                      onClick={() => onJumpToMessage(pin.sourceId)}
                      className="text-sm text-gray-800 text-left hover:text-blue-600 transition-colors"
                    >
                      {pin.label}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-800">{pin.label}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {label} · pinned by {pin.pinnedByName} ·{' '}
                    {new Date(pin.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {canUnpin && (
                  <button
                    onClick={() => handleUnpin(pin)}
                    disabled={busyId === pin._id}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-rose-600 p-1 rounded transition-all disabled:opacity-50 shrink-0"
                    title="Unpin"
                  >
                    {busyId === pin._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
