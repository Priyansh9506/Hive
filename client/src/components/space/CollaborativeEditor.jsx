import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import { useAuth } from '../../context/AuthContext';
import api, { getAccessToken } from '../../lib/api';
import { Cloud, CheckCircle2, Loader2, Save, Wifi, WifiOff, Highlighter, Users, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

Quill.register('modules/cursors', QuillCursors);

// Notes on either side of a selection sent with "Explain", so the explanation
// fits the topic (e.g. "mole" in chemistry notes)
const EXPLAIN_CONTEXT_CHARS = 1500;

export default function CollaborativeEditor({ spaceId, initialNotes = '', onHighlight, onExplain }) {
  const containerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const selectionRangeRef = useRef(null); // last non-empty selection, for "Explain"
  // Whether the notes changed since this tab last saved a version. Unknown on
  // load, so the first "Save Now" always asks the server.
  const changedSinceVersionRef = useRef(true);
  const { user } = useAuth();

  const [status, setStatus] = useState('connecting');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [peers, setPeers] = useState([]);       // others editing right now
  const [selection, setSelection] = useState(''); // currently selected text
  const [authError, setAuthError] = useState(false);
  const [versionSaving, setVersionSaving] = useState(false);

  // Core save function to MongoDB
  const saveToDatabase = useCallback(async (contentToSave) => {
    if (!spaceId) return;
    try {
      setSaveStatus('saving');
      await api.patch(`/spaces/${spaceId}/notes`, {
        notesContent: contentToSave,
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Failed to save notes to database:', err);
      setSaveStatus('error');
    }
  }, [spaceId]);

  // Send the selection to the AI assistant along with the notes around it
  const handleExplain = () => {
    const editor = editorInstanceRef.current;
    const range = selectionRangeRef.current;
    if (!editor || !range) return;

    const text = editor.getText(range.index, range.length).trim();
    if (!text) return;

    const start = Math.max(0, range.index - EXPLAIN_CONTEXT_CHARS);
    const context = editor.getText(start, range.index + range.length + EXPLAIN_CONTEXT_CHARS - start).trim();
    onExplain(text, context);
  };

  // "Save Now": store the notes as a version in the history, but only when they
  // changed since the last version. Nothing changed in this tab since the last
  // save means nothing to ask the server; otherwise the server compares the
  // content (other members' edits count too) and decides.
  const handleManualSave = async () => {
    const editor = editorInstanceRef.current;
    if (!editor || versionSaving) return;

    if (!changedSinceVersionRef.current) {
      toast('No changes since your last save', { icon: '✓' });
      return;
    }

    // Write the pending HTML copy as well, so it matches the version
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      saveToDatabase(editor.root.innerHTML);
    }

    // Cleared before the request, so an edit made while it is in flight
    // marks the notes as changed again
    changedSinceVersionRef.current = false;
    setVersionSaving(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/versions/save`);
      if (res.data.alreadySaved) {
        toast(res.data.message, { icon: '✓' });
      } else {
        toast.success(res.data.message);
      }
    } catch (err) {
      changedSinceVersionRef.current = true;
      toast.error(err.response?.data?.message || 'Could not save a version. Please try again.');
    } finally {
      setVersionSaving(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Wipe out any previous content/toolbars in container to prevent duplicate toolbars
    container.innerHTML = '';

    // 2. Create a clean child element for Quill to mount into
    const editorHost = document.createElement('div');
    editorHost.className = 'quill-host-editor flex-1 overflow-y-auto';
    container.appendChild(editorHost);

    // 3. Initialize Yjs doc & WebSockets
    const ydoc = new Y.Doc();
    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const cleanUrl = rawUrl.replace(/\/api\/?$/, '').replace(/^http/, 'ws');
    // The server authenticates the Yjs upgrade and checks space membership, so
    // the token has to travel with the handshake (it becomes a query param).
    // A getter, because the provider rebuilds its URL from `params` on every
    // reconnect and the short-lived access token changes in the meantime.
    const provider = new WebsocketProvider(
      `${cleanUrl}/yjs`,
      `studysync-room-${spaceId}`,
      ydoc,
      { params: { get token() { return getAccessToken() || ''; } } }
    );

    provider.on('status', event => {
      setStatus(event.status); // 'connected' or 'disconnected'
    });

    // A rejected handshake (expired token, membership revoked) would otherwise
    // just look like an ordinary reconnect loop.
    provider.on('connection-close', (event) => {
      if (event?.code === 4001 || event?.code === 1006) {
        setAuthError(true);
      }
    });

    const ytext = ydoc.getText('quill');

    // 4. Initialize Quill on the newly created DOM host
    const editor = new Quill(editorHost, {
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'clean'],
        ],
        history: {
          userOnly: true,
        },
      },
      placeholder: 'Start taking notes collaboratively... Everyone in this space will see your changes live.',
      theme: 'snow',
    });

    editorInstanceRef.current = editor;

    // 5. Bind Quill to Yjs
    const binding = new QuillBinding(ytext, editor, provider.awareness);

    // 6. Seed from the saved HTML only for spaces that have no shared doc yet. The server
    //    loads the stored doc before the first sync, so the doc is only empty after sync
    //    when there is nothing to merge with. Seeding before sync duplicates the notes.
    let seeded = false;
    const seedFromHtml = (isSynced) => {
      if (!isSynced || seeded) return;
      seeded = true;
      if (ytext.length === 0 && initialNotes && initialNotes.trim() !== '<p><br></p>') {
        try {
          editor.clipboard.dangerouslyPasteHTML(initialNotes);
        } catch (e) {
          console.error('Failed to seed initial notes:', e);
        }
      }
    };

    provider.on('synced', seedFromHtml);

    // 7. Awareness (Live cursor tracking for other members)
    const randomColor = '#' + ['3b82f6', '10b981', 'f59e0b', 'ec4899', '8b5cf6', '06b6d4'][
      Math.floor(Math.random() * 6)
    ];
    provider.awareness.setLocalStateField('user', {
      name: user?.name || 'Anonymous',
      color: randomColor,
    });

    // Surface everyone currently in the document. Awareness states are keyed by
    // client id, so the same person in two tabs appears once per tab — dedupe by name.
    const syncPeers = () => {
      const seen = new Map();
      provider.awareness.getStates().forEach((state, clientId) => {
        if (!state.user || clientId === provider.awareness.clientID) return;
        seen.set(state.user.name, state.user);
      });
      setPeers([...seen.values()]);
    };
    provider.awareness.on('change', syncPeers);
    syncPeers();

    // 8. Auto-save on change (debounced 1.5s)
    // Fires for remote edits too, which also make the next "Save Now" count
    const handleTextChange = () => {
      changedSinceVersionRef.current = true;
      setSaveStatus('unsaved');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const html = editor.root.innerHTML;
        saveToDatabase(html);
      }, 1500);
    };

    editor.on('text-change', handleTextChange);

    // Track the selected text so "Highlight" and "Explain" know what to capture.
    // A null range means the editor lost focus, e.g. to one of those buttons,
    // not that the selection went away, so the last one is kept for the click.
    const handleSelectionChange = (range) => {
      if (!range) return;
      selectionRangeRef.current = range.length > 0 ? range : null;
      setSelection(range.length > 0 ? editor.getText(range.index, range.length).trim() : '');
    };
    editor.on('selection-change', handleSelectionChange);

    // 9. Cleanup on unmount or spaceId change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Flush any pending save before unmounting
        if (editorInstanceRef.current) {
          const finalHtml = editorInstanceRef.current.root.innerHTML;
          api.patch(`/spaces/${spaceId}/notes`, { notesContent: finalHtml }).catch(() => {});
        }
      }
      editor.off('text-change', handleTextChange);
      editor.off('selection-change', handleSelectionChange);
      provider.awareness.off('change', syncPeers);
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
      editorInstanceRef.current = null;

      // Remove toolbar and editor from DOM so no stale toolbars linger
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [spaceId, user?.name, initialNotes, saveToDatabase]);

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl shadow-xs border border-gray-200 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200 gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Shared Notes</h3>
          
          {/* Real-time Save Status Pill */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <span className="text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <Loader2 size={12} className="animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 size={12} />
                {lastSavedTime
                  ? `Saved ${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Saved to cloud'}
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                <Cloud size={12} /> Unsaved edits
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Save failed (retrying)
              </span>
            )}
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          {/* Who else is in the document right now */}
          {peers.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 pr-1" title={`${peers.map((p) => p.name).join(', ')} editing now`}>
              <Users size={13} className="text-gray-400" />
              <div className="flex -space-x-1.5">
                {peers.slice(0, 3).map((p) => (
                  <span
                    key={p.name}
                    className="h-5 w-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-gray-50"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
              {peers.length > 3 && <span className="text-[10px] text-gray-500">+{peers.length - 3}</span>}
            </div>
          )}

          {/* Turn the current selection into a categorised highlight (PRD §16) */}
          {onHighlight && (
            <button
              onClick={() => onHighlight(selection)}
              disabled={!selection}
              className="text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-amber-50 active:bg-amber-100 border border-gray-300 text-gray-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={selection ? 'Mark the selected text as a highlight' : 'Select some text in the notes first'}
            >
              <Highlighter size={13} />
              <span className="hidden sm:inline">Highlight</span>
            </button>
          )}

          {/* Ask the AI assistant to explain the selection simply */}
          {onExplain && (
            <button
              onClick={handleExplain}
              disabled={!selection}
              className="text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-violet-50 active:bg-violet-100 border border-gray-300 text-gray-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={selection ? 'Explain the selected text simply' : 'Select some text in the notes first'}
            >
              <Sparkles size={13} className="text-violet-500" />
              <span className="hidden sm:inline">Explain</span>
            </button>
          )}

          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            disabled={versionSaving}
            className="text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Save the notes as a new version in Version history (only if they changed)"
          >
            {versionSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{versionSaving ? 'Saving...' : 'Save Now'}</span>
          </button>

          {/* Real-time Sync Connection Indicator */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 border ${
              status === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={status === 'connected' ? 'Connected to real-time sync server' : 'Disconnected from real-time sync server'}
          >
            {status === 'connected' ? (
              <>
                <Wifi size={12} />
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>Offline</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* A rejected handshake means the session or membership is no longer valid,
          which a plain "Offline" pill would misrepresent as a network blip. */}
      {authError && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-start gap-2 shrink-0">
          <ShieldAlert size={15} className="text-rose-600 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-700 leading-relaxed">
            Live sync was refused. Your session may have expired, or you no longer have access to this space.
            Your local edits are safe — reload the page to reconnect.
          </p>
        </div>
      )}

      {/* Editor Main Container (Toolbar + Editable Area) */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col min-h-0 overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b! [&_.ql-toolbar]:border-gray-200! [&_.ql-toolbar]:bg-surface [&_.ql-container]:border-none [&_.ql-container]:flex-1 [&_.ql-container]:overflow-y-auto [&_.ql-editor]:min-h-full [&_.ql-editor]:text-base [&_.ql-editor]:leading-relaxed [&_.ql-editor]:p-4 sm:[&_.ql-editor]:p-6"
      />
    </div>
  );
}
