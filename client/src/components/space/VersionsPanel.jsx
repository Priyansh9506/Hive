import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, History, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { useSocket } from '../../context/SocketContext';
import api from '../../lib/api';

const stamp = (iso) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Saved versions of the shared notes (PRD §20). The server takes a snapshot every
 * few minutes while people edit; this lists them, shows one in full, and can
 * restore it into the live document for everyone.
 */
export default function VersionsPanel({ spaceId, onRestored }) {
  const socket = useSocket();
  const [versions, setVersions] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null); // full version being read
  const [loadingVersion, setLoadingVersion] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/versions`);
      setVersions(res.data.versions);
      setLastSavedAt(res.data.lastSavedAt);
    } catch (err) {
      console.error('Failed to load versions', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadVersions();
  }, [loadVersions]);

  // Snapshots are taken server-side; a restore by anyone is the one event that
  // is announced, and it always adds a version, so refresh on it.
  useEffect(() => {
    if (!socket) return;
    const handleActivity = (activity) => {
      if (String(activity.spaceId) === String(spaceId) && activity.type === 'snapshot_restored') {
        loadVersions();
      }
    };
    socket.on('activity_new', handleActivity);
    return () => socket.off('activity_new', handleActivity);
  }, [socket, spaceId, loadVersions]);

  const openVersion = async (version) => {
    setLoadingVersion(version.version);
    try {
      const res = await api.get(`/spaces/${spaceId}/versions/${version.version}`);
      setViewing(res.data.version);
      setConfirming(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to open this version');
    } finally {
      setLoadingVersion(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/versions/${viewing.version}/restore`);
      toast.success(res.data.message);
      setViewing(null);
      setConfirming(false);
      loadVersions();
      onRestored?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore this version');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0 gap-2">
        {viewing ? (
          <button
            onClick={() => { setViewing(null); setConfirming(false); }}
            className="font-semibold text-gray-700 flex items-center gap-2 hover:text-gray-900"
          >
            <ArrowLeft size={15} /> Version {viewing.version}
          </button>
        ) : (
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <History size={15} /> Version history
          </h3>
        )}
        {!viewing && lastSavedAt && (
          <span className="text-[11px] text-gray-400">Last saved {stamp(lastSavedAt)}</span>
        )}
      </div>

      {viewing ? (
        <>
          <div className="px-4 py-2 border-b text-[11px] text-gray-500 shrink-0">
            Saved {stamp(viewing.createdAt)} · last edited by {viewing.createdByName} · {viewing.charCount} characters
          </div>

          {/* Plain text is enough to recognise a version; restore brings back the formatting */}
          <pre className="flex-1 overflow-y-auto p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {viewing.text || <span className="text-gray-400">This version is empty.</span>}
          </pre>

          <div className="border-t p-3 shrink-0 bg-gray-50">
            {confirming ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 leading-relaxed">
                  This replaces the shared notes for everyone in the space. The current notes are saved as a
                  new version first, so you can switch back.
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={restoring}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleRestore} disabled={restoring}>
                    {restoring && <Loader2 size={13} className="animate-spin mr-1.5" />}
                    Restore version {viewing.version}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setConfirming(true)}>
                <RotateCcw size={13} className="mr-1.5" /> Restore this version
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <History size={22} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 font-medium">No saved versions yet</p>
              <p className="text-xs text-gray-400 mt-1">
                A version is saved automatically every few minutes while the notes are being edited.
              </p>
            </div>
          ) : (
            versions.map((v) => (
              <button
                key={v._id}
                onClick={() => openVersion(v)}
                disabled={loadingVersion !== null}
                className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">Version {v.version}</span>
                  {loadingVersion === v.version ? (
                    <Loader2 size={13} className="animate-spin text-gray-400" />
                  ) : (
                    <span className="text-[11px] text-gray-400">{stamp(v.createdAt)}</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{v.createdByName}</p>
                {v.preview && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{v.preview}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
