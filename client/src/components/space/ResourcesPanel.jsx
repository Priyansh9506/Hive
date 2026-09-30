import React, { useCallback, useEffect, useState } from 'react';
import {
  Code2, ExternalLink, FileText, FileUp, Image as ImageIcon, Loader2,
  Pin, PinOff, Plus, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import AddResourceModal from './AddResourceModal';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

// Uploads are served from the API origin, not the Vite dev origin
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const fullUrl = (url) => (url?.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

const TYPE_META = {
  link: { icon: ExternalLink, tint: 'text-blue-500 bg-blue-50' },
  image: { icon: ImageIcon, tint: 'text-emerald-600 bg-emerald-50' },
  pdf: { icon: FileText, tint: 'text-rose-600 bg-rose-50' },
  document: { icon: FileText, tint: 'text-amber-600 bg-amber-50' },
  code: { icon: Code2, tint: 'text-violet-600 bg-violet-50' },
  file: { icon: FileUp, tint: 'text-gray-500 bg-gray-100' },
};

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'link', label: 'Links' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'document', label: 'Docs' },
  { id: 'code', label: 'Code' },
];

const formatSize = (bytes) => {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function ResourcesPanel({ spaceId, userRole, onPinsChanged }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null); // code snippet being viewed

  const loadResources = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/resources`);
      setResources(res.data.resources);
    } catch (err) {
      console.error('Failed to load resources', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadResources();
  }, [loadResources]);

  // ---------- Live updates ----------
  useEffect(() => {
    if (!socket) return;

    const handleAdded = (resource) => {
      if (String(resource.spaceId) !== String(spaceId)) return;
      setResources((prev) =>
        prev.some((r) => r._id === resource._id) ? prev : [resource, ...prev]
      );
    };

    const handleDeleted = ({ resourceId }) => {
      setResources((prev) => prev.filter((r) => r._id !== resourceId));
    };

    // A pin made elsewhere (or from the pins panel) flips the badge here too
    const handlePin = ({ sourceType, sourceId }, pinned) => {
      if (sourceType !== 'resource') return;
      setResources((prev) => prev.map((r) => (r._id === sourceId ? { ...r, isPinned: pinned } : r)));
    };
    const onPinAdded = (pin) => handlePin(pin, true);
    const onPinRemoved = (pin) => handlePin(pin, false);

    socket.on('resource_added', handleAdded);
    socket.on('resource_deleted', handleDeleted);
    socket.on('pin_added', onPinAdded);
    socket.on('pin_removed', onPinRemoved);

    return () => {
      socket.off('resource_added', handleAdded);
      socket.off('resource_deleted', handleDeleted);
      socket.off('pin_added', onPinAdded);
      socket.off('pin_removed', onPinRemoved);
    };
  }, [socket, spaceId]);

  // ---------- Actions ----------
  const handleDelete = async (resource) => {
    setBusyId(resource._id);
    try {
      await api.delete(`/spaces/${spaceId}/resources/${resource._id}`);
      setResources((prev) => prev.filter((r) => r._id !== resource._id));
      toast.success('Resource removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove resource');
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePin = async (resource) => {
    setBusyId(resource._id);
    try {
      if (resource.isPinned) {
        // The pin row is keyed by its source, so look it up to unpin
        const { data } = await api.get(`/spaces/${spaceId}/pins`);
        const pin = data.pins.find(
          (p) => p.sourceType === 'resource' && String(p.sourceId) === String(resource._id)
        );
        if (!pin) throw new Error('Pin not found');
        await api.delete(`/spaces/${spaceId}/pins/${pin._id}`);
        setResources((prev) => prev.map((r) => (r._id === resource._id ? { ...r, isPinned: false } : r)));
        toast.success('Unpinned');
      } else {
        await api.post(`/spaces/${spaceId}/pins`, { sourceType: 'resource', sourceId: resource._id });
        setResources((prev) => prev.map((r) => (r._id === resource._id ? { ...r, isPinned: true } : r)));
        toast.success('Pinned');
      }
      onPinsChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update pin');
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter ? resources.filter((r) => r.type === filter) : resources;

  return (
    <div className="flex flex-col h-full bg-surface rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0 gap-2">
        <h3 className="font-semibold text-gray-700">Resources</h3>
        <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => setAddOpen(true)}>
          <Plus size={13} className="mr-1" /> Add
        </Button>
      </div>

      {/* Type filter */}
      <div className="px-3 py-2 border-b flex gap-1 overflow-x-auto shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              filter === f.id ? 'bg-ink text-paper' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading resources...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <FileUp size={22} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">
              {filter ? 'Nothing of this type yet' : 'No resources yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Share a link, screenshot, PDF or code snippet with the group.
            </p>
          </div>
        ) : (
          visible.map((resource) => {
            const { icon: Icon, tint } = TYPE_META[resource.type] || TYPE_META.file;
            const canDelete = String(resource.uploadedBy) === String(user.id) || userRole === 'owner';
            const href = fullUrl(resource.url);

            return (
              <div
                key={resource._id}
                className="group border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <span className={`p-1.5 rounded-md shrink-0 ${tint}`}>
                    <Icon size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      {resource.type === 'code' ? (
                        <button
                          onClick={() => setExpanded(expanded === resource._id ? null : resource._id)}
                          className="text-sm font-medium text-gray-800 hover:text-blue-600 text-left truncate"
                        >
                          {resource.title}
                        </button>
                      ) : (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate"
                        >
                          {resource.title}
                        </a>
                      )}
                      {resource.isPinned && (
                        <Pin size={11} className="text-amber-500 shrink-0 mt-1" title="Pinned" />
                      )}
                    </div>

                    {resource.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{resource.description}</p>
                    )}

                    <p className="text-[10px] text-gray-400 mt-1">
                      {resource.uploadedByName}
                      {' · '}
                      {new Date(resource.createdAt).toLocaleDateString()}
                      {resource.metadata?.size ? ` · ${formatSize(resource.metadata.size)}` : ''}
                    </p>

                    {/* Inline preview for images — the point of sharing a screenshot */}
                    {resource.type === 'image' && (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block mt-2">
                        <img
                          src={href}
                          alt={resource.title}
                          loading="lazy"
                          className="max-h-40 w-auto rounded border border-gray-200 object-contain bg-gray-50"
                        />
                      </a>
                    )}

                    {resource.type === 'code' && expanded === resource._id && (
                      <pre className="mt-2 p-2.5 bg-[#18181b] text-zinc-100 rounded text-[11px] leading-relaxed overflow-x-auto">
                        <code>{resource.metadata?.code}</code>
                      </pre>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleTogglePin(resource)}
                      disabled={busyId === resource._id}
                      className="text-gray-400 hover:text-amber-600 p-1 rounded disabled:opacity-50"
                      title={resource.isPinned ? 'Unpin' : 'Pin to the space'}
                    >
                      {busyId === resource._id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : resource.isPinned ? (
                        <PinOff size={13} />
                      ) : (
                        <Pin size={13} />
                      )}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(resource)}
                        disabled={busyId === resource._id}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded disabled:opacity-50"
                        title="Delete resource"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddResourceModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        spaceId={spaceId}
        onAdded={(resource) =>
          setResources((prev) => (prev.some((r) => r._id === resource._id) ? prev : [resource, ...prev]))
        }
      />
    </div>
  );
}
