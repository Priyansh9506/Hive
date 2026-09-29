import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Send, Loader2 } from 'lucide-react';
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

export default function ChatPanel({ spaceId }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeout = useRef(null);
  const isInitialLoad = useRef(true);

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

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingHistory && isInitialLoad.current) {
      scrollToBottom('instant');
      isInitialLoad.current = false;
    }
  }, [loadingHistory, scrollToBottom]);

  // ---------- Load older messages (pagination) ----------
  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;

    try {
      const oldest = messages[0]?.createdAt;
      const res = await api.get(`/spaces/${spaceId}/messages?limit=40&before=${oldest}`);
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMore(res.data.hasMore);

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

  // ---------- Socket.IO listeners ----------
  useEffect(() => {
    if (!socket) return;

    const joinRoom = () => socket.emit('join_space', spaceId);
    joinRoom();

    // Room membership lives on the server-side socket, so a reconnect (server restart,
    // network drop) starts in no rooms. Re-join, then pull anything sent while offline.
    const handleReconnect = async () => {
      joinRoom();
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
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);

    return () => {
      socket.emit('leave_space', spaceId);
      socket.io.off('reconnect', handleReconnect);
      socket.off('receive_message', handleMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
    };
  }, [socket, spaceId, user.id, scrollToBottom]);

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
            return (
              <div
                key={msg._id || msg.clientId}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-[10px] text-gray-400 ml-1 mb-0.5">{msg.senderName}</span>
                )}
                <div
                  className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words ${
                    isOwn
                      ? `bg-blue-600 text-white ${msg._optimistic ? 'opacity-70' : ''}`
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.content}
                </div>
                <span className={`text-[10px] mx-1 mt-0.5 ${msg._failed ? 'text-red-500' : 'text-gray-300'}`}>
                  {msg._failed ? 'Not sent' : formatTime(msg.createdAt)}
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
