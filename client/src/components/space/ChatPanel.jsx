import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Send, Loader2, MoreHorizontal, Pencil, Trash2, Pin, PinOff, Highlighter } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// Generate a simple client-side unique ID for optimistic messages
const clientMsgId = () => `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Merge saved messages into the list: incoming ones replace any copy with the same _id
// or clientId (i.e. the optimistic version), and the result stays in chronological order.
const mergeMessages = (current, incoming) => {
  const ids = new Set(incoming.map((m) => m._id));
  const clientIds = new Set(incoming.map((m) => m.clientId).filter(Boolean));
  const kept = current.filter((m) => !ids.has(m._id) && !(m.clientId && clientIds.has(m.clientId)));
  return [...kept, ...incoming].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

// Older pages fetched while looking for a message to jump to, before giving up
const MAX_JUMP_PAGES = 10;

/**
 * Room membership is owned by the workspace page, not this panel: the panel can
 * unmount (mobile tab switch, hidden sidebar) while the space stays open, and
 * other panels rely on the same room for live updates.
 */
export default function ChatPanel({ spaceId, userRole, onHighlight, jumpToMessageId, onJumpHandled }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [menuFor, setMenuFor] = useState(null);         // message id whose action menu is open
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null);         // { id, content }
  const [flashId, setFlashId] = useState(null);         // message briefly highlighted after a jump
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeout = useRef(null);
  const isInitialLoad = useRef(true);
  // Read by the jump loop, which fetches several pages before React re-renders
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  useEffect(() => {
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
  }, [messages, hasMore]);

  // Scroll to bottom (only on initial load and new own messages)
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // ---------- Load message history (REST) ----------
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      setMessages([]);
      try {
        const res = await api.get(`/spaces/${spaceId}/messages?limit=40`);
        // Merge rather than replace: live messages may have arrived while this loaded
        setMessages((prev) => mergeMessages(prev, res.data.messages));
        setHasMore(res.data.hasMore);
        isInitialLoad.current = true;
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [spaceId]);

  // Scroll to bottom on initial load (unless we are about to jump elsewhere)
  useEffect(() => {
    if (!loadingHistory && isInitialLoad.current) {
      if (!jumpToMessageId) scrollToBottom('instant');
      isInitialLoad.current = false;
    }
  }, [loadingHistory, scrollToBottom, jumpToMessageId]);

  // ---------- Load older messages (pagination) ----------
  const fetchOlder = useCallback(async () => {
    const oldest = messagesRef.current[0]?.createdAt;
    if (!oldest) return false;
    const res = await api.get(`/spaces/${spaceId}/messages?limit=40&before=${oldest}`);
    setMessages((prev) => mergeMessages(prev, res.data.messages));
    setHasMore(res.data.hasMore);
    hasMoreRef.current = res.data.hasMore;
    // Keep the ref current for a caller looping over pages before re-render
    messagesRef.current = mergeMessages(messagesRef.current, res.data.messages);
    return res.data.hasMore;
  }, [spaceId]);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;

    try {
      await fetchOlder();
      // Maintain scroll position after prepending older messages
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevHeight;
        }
      });
    } catch (err) {
      console.error('Failed to load more messages', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ---------- Jump to a message (from pins or search) ----------
  useEffect(() => {
    if (!jumpToMessageId || loadingHistory) return;
    let cancelled = false;

    const jump = async () => {
      const has = () => messagesRef.current.some((m) => String(m._id) === String(jumpToMessageId));
      try {
        for (let page = 0; !has() && hasMoreRef.current && page < MAX_JUMP_PAGES; page++) {
          await fetchOlder();
          if (cancelled) return;
        }
      } catch (err) {
        console.error('Failed to load messages for jump', err);
      }
      if (cancelled) return;

      if (!has()) {
        toast.error('That message could not be found — it may have been deleted');
      } else {
        // Let the fetched page render before looking for its element
        requestAnimationFrame(() => {
          document.getElementById(`msg-${jumpToMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setFlashId(String(jumpToMessageId));
          setTimeout(() => setFlashId(null), 2000);
        });
      }
      onJumpHandled?.();
    };
    jump();
    return () => { cancelled = true; };
  }, [jumpToMessageId, loadingHistory, fetchOlder, onJumpHandled]);

  // ---------- Socket.IO listeners ----------
  useEffect(() => {
    if (!socket) return;

    // The workspace re-joins the room on reconnect; this pulls anything sent while offline
    const handleReconnect = async () => {
      setTypingUsers([]);
      try {
        const res = await api.get(`/spaces/${spaceId}/messages?limit=40`);
        setMessages((prev) => mergeMessages(prev, res.data.messages));
      } catch (err) {
        console.error('Failed to resync messages', err);
      }
    };

    const handleMessage = (msg) => {
      if (String(msg.spaceId) !== String(spaceId)) return;
      setMessages((prev) => mergeMessages(prev, [msg]));

      // Auto-scroll if near the bottom
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (isNearBottom) {
          requestAnimationFrame(() => scrollToBottom());
        }
      }
    };

    const handleUpdated = (msg) => {
      if (String(msg.spaceId) !== String(spaceId)) return;
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? { ...m, ...msg } : m)));
    };

    const handleDeleted = ({ spaceId: id, messageId, deletedAt }) => {
      if (String(id) !== String(spaceId)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, deletedAt, content: 'This message was deleted', isPinned: false }
            : m
        )
      );
    };

    const setPinned = ({ sourceType, sourceId }, isPinned) => {
      if (sourceType !== 'message') return;
      setMessages((prev) => prev.map((m) => (String(m._id) === String(sourceId) ? { ...m, isPinned } : m)));
    };
    const handlePinAdded = (pin) => setPinned(pin, true);
    const handlePinRemoved = (pin) => setPinned(pin, false);

    const handleTyping = ({ userId, name }) => {
      if (userId === user.id) return;
      setTypingUsers((prev) => {
        if (prev.find((u) => u.userId === userId)) return prev;
        return [...prev, { userId, name }];
      });
    };

    const handleStopTyping = ({ userId }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.io.on('reconnect', handleReconnect);
    socket.on('receive_message', handleMessage);
    socket.on('message_updated', handleUpdated);
    socket.on('message_deleted', handleDeleted);
    socket.on('pin_added', handlePinAdded);
    socket.on('pin_removed', handlePinRemoved);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);

    return () => {
      socket.io.off('reconnect', handleReconnect);
      socket.off('receive_message', handleMessage);
      socket.off('message_updated', handleUpdated);
      socket.off('message_deleted', handleDeleted);
      socket.off('pin_added', handlePinAdded);
      socket.off('pin_removed', handlePinRemoved);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
    };
  }, [socket, spaceId, user.id, scrollToBottom]);

  // Close the action menu on any outside click
  useEffect(() => {
    if (!menuFor) return;
    const close = (e) => {
      if (!e.target.closest?.('[data-msg-menu]')) {
        setMenuFor(null);
        setConfirmDelete(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  // ---------- Send message (optimistic) ----------
  const sendMessage = (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !socket) return;

    const cid = clientMsgId();

    // Optimistic insert (shown immediately)
    const optimisticMsg = {
      _id: cid,
      clientId: cid,
      spaceId,
      senderId: user.id,
      senderName: user.name,
      content,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    scrollToBottom();

    // Emit to server; the ack carries the saved message (or an error) back to us
    socket.emit('send_message', { spaceId, content, clientId: cid }, (res) => {
      if (res?.message) {
        setMessages((prev) => mergeMessages(prev, [res.message]));
      } else {
        setMessages((prev) => prev.map((m) => (m.clientId === cid ? { ...m, _failed: true } : m)));
      }
    });

    // Stop typing indicator
    socket.emit('typing_stop', spaceId);
    clearTimeout(typingTimeout.current);
  };

  // ---------- Typing indicator ----------
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket) return;

    socket.emit('typing_start', spaceId);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing_stop', spaceId);
    }, 2000);
  };

  // ---------- Message actions ----------
  const closeMenu = () => {
    setMenuFor(null);
    setConfirmDelete(null);
  };

  const saveEdit = async () => {
    const content = editing.content.trim();
    const original = messages.find((m) => m._id === editing.id);
    if (!content || content === original?.content) {
      setEditing(null);
      return;
    }
    try {
      const res = await api.patch(`/spaces/${spaceId}/messages/${editing.id}`, { content });
      setMessages((prev) => prev.map((m) => (m._id === editing.id ? { ...m, ...res.data.message } : m)));
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to edit message');
    }
  };

  const deleteMessage = async (msg) => {
    closeMenu();
    try {
      await api.delete(`/spaces/${spaceId}/messages/${msg._id}`);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id
            ? { ...m, deletedAt: new Date().toISOString(), content: 'This message was deleted', isPinned: false }
            : m
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message');
    }
  };

  const togglePin = async (msg) => {
    closeMenu();
    try {
      if (msg.isPinned) {
        // Pins are keyed by their source, so find this message's pin to remove it
        const { data } = await api.get(`/spaces/${spaceId}/pins`);
        const pin = data.pins.find((p) => p.sourceType === 'message' && String(p.sourceId) === String(msg._id));
        if (!pin) throw new Error('Pin not found');
        await api.delete(`/spaces/${spaceId}/pins/${pin._id}`);
        toast.success('Unpinned');
      } else {
        await api.post(`/spaces/${spaceId}/pins`, { sourceType: 'message', sourceId: msg._id });
        toast.success('Pinned to the space');
      }
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? { ...m, isPinned: !msg.isPinned } : m)));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update pin');
    }
  };

  // ---------- Render ----------
  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-700">Discussion</h3>
        <span className="text-xs text-gray-400">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        onScroll={(e) => {
          // Load more when scrolled to top
          if (e.target.scrollTop < 40 && hasMore && !loadingMore) {
            loadOlderMessages();
          }
        }}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        )}

        {hasMore && !loadingMore && (
          <button
            onClick={loadOlderMessages}
            className="w-full text-xs text-blue-500 hover:text-blue-700 py-1"
          >
            Load older messages
          </button>
        )}

        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user.id || msg.senderId === user._id;
            const isDeleted = !!msg.deletedAt;
            const isEditing = editing?.id === msg._id;
            const canAct = !isDeleted && !msg._optimistic && !isEditing;
            const canDelete = isOwn || userRole === 'owner';

            return (
              <div
                key={msg._id || msg.clientId}
                id={`msg-${msg._id}`}
                className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-[10px] text-gray-400 ml-1 mb-0.5">{msg.senderName}</span>
                )}

                <div className={`flex items-center gap-1 max-w-[85%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                  {isEditing ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
                      className="flex flex-col items-end gap-1 w-64 max-w-full"
                    >
                      <input
                        autoFocus
                        value={editing.content}
                        onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        maxLength={5000}
                        className="w-full text-sm border border-blue-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <span className="text-[10px] text-gray-400">Enter to save · Esc to cancel</span>
                    </form>
                  ) : (
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-sm break-words transition-shadow ${
                        isDeleted
                          ? 'bg-gray-50 text-gray-400 italic border border-dashed border-gray-200'
                          : isOwn
                            ? `bg-blue-600 text-white ${msg._optimistic ? 'opacity-70' : ''}`
                            : 'bg-gray-100 text-gray-800'
                      } ${flashId === String(msg._id) ? 'ring-4 ring-amber-300' : ''}`}
                    >
                      {msg.content}
                    </div>
                  )}

                  {canAct && (
                    <div className="relative shrink-0" data-msg-menu>
                      <button
                        onClick={() => { setMenuFor(menuFor === msg._id ? null : msg._id); setConfirmDelete(null); }}
                        className={`p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-opacity ${
                          menuFor === msg._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                        title="Message actions"
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {menuFor === msg._id && (
                        <div
                          className={`absolute z-20 top-7 ${isOwn ? 'right-0' : 'left-0'} w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm`}
                        >
                          {confirmDelete === msg._id ? (
                            <div className="px-3 py-2 space-y-2">
                              <p className="text-xs text-gray-600">Delete this message?</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => deleteMessage(msg)}
                                  className="flex-1 text-xs bg-rose-600 text-white rounded px-2 py-1 hover:bg-rose-700"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="flex-1 text-xs border rounded px-2 py-1 hover:bg-gray-50"
                                >
                                  Keep
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => togglePin(msg)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                              >
                                {msg.isPinned ? <><PinOff size={13} /> Unpin</> : <><Pin size={13} /> Pin</>}
                              </button>
                              {onHighlight && (
                                <button
                                  onClick={() => {
                                    closeMenu();
                                    onHighlight({ sourceType: 'message', sourceId: msg._id, text: msg.content });
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                                >
                                  <Highlighter size={13} /> Highlight
                                </button>
                              )}
                              {isOwn && (
                                <button
                                  onClick={() => { closeMenu(); setEditing({ id: msg._id, content: msg.content }); }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setConfirmDelete(msg._id)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className={`text-[10px] mx-1 mt-0.5 flex items-center gap-1 ${msg._failed ? 'text-red-500' : 'text-gray-300'}`}>
                  {msg.isPinned && !isDeleted && <Pin size={9} className="text-amber-500" />}
                  {msg._failed ? 'Not sent' : formatTime(msg.createdAt)}
                  {msg.editedAt && !isDeleted && <span>· edited</span>}
                </span>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-400 italic px-1">
            {typingUsers.map((u) => u.name).join(', ')}{' '}
            {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t px-3 py-2 flex items-center gap-2 shrink-0 bg-gray-50">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 text-sm bg-white border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-colors"
          maxLength={5000}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
