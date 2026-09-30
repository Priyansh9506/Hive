import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, LogIn, Mail, UserMinus, AtSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import api from '../../lib/api';
import { usePopIn } from '../../hooks/usePopIn';

const TYPE_ICON = {
  invite_received: Mail,
  member_joined: LogIn,
  removed_from_space: UserMinus,
  mentioned: AtSign,
};

const timeAgo = (iso) => {
  const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString();
};

// Brand tokens of the surrounding AppShell (light or dark)
const look = {
  button: 'text-ink-soft hover:text-ink hover:bg-sunk cursor-pointer',
  panel: 'bg-surface rounded-2xl border border-line ls-lift',
  divider: 'border-line',
  heading: 'text-ink',
  markAll: 'text-flame hover:opacity-80 cursor-pointer',
  muted: 'text-ink-faint',
  emptyIcon: 'text-ink-faint',
  emptyTitle: 'text-ink-soft',
  row: 'hover:bg-sunk',
  rowUnread: 'bg-flame-wash/60',
  iconRead: 'bg-sunk text-ink-faint',
  iconUnread: 'bg-flame-wash text-flame',
  titleRead: 'text-ink-soft',
  titleUnread: 'text-ink font-medium',
  body: 'text-ink-faint',
  dismiss: 'text-ink-faint hover:text-ink cursor-pointer',
  // Touch screens have no hover to reveal the dismiss button
  touchVisible: '[@media(hover:none)]:opacity-100',
};

export default function NotificationsBell() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  usePopIn(panelRef, open);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=30');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live delivery to the user's personal room
  useEffect(() => {
    if (!socket) return;

    const handleNew = (notification) => {
      setNotifications((prev) =>
        prev.some((n) => n._id === notification._id) ? prev : [notification, ...prev]
      );
      setUnreadCount((c) => c + 1);
      toast(notification.title, { icon: '🔔' });
    };

    // Missed while disconnected — resync rather than guess
    const handleReconnect = () => load();

    socket.on('notification_new', handleNew);
    socket.io.on('reconnect', handleReconnect);
    return () => {
      socket.off('notification_new', handleNew);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, load]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = async (notification) => {
    setOpen(false);
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(c - 1, 0));
      api.patch(`/notifications/${notification._id}/read`).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark notifications as read');
    }
  };

  const handleDismiss = async (e, notification) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n._id !== notification._id));
    if (!notification.read) setUnreadCount((c) => Math.max(c - 1, 0));
    try {
      await api.delete(`/notifications/${notification._id}`);
    } catch {
      load(); // put it back the way the server has it
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-full ${look.button} transition-colors`}
        title="Notifications"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className={`fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-12 sm:w-80 ${look.panel} z-50 overflow-hidden`}>
          <div className={`px-4 py-2.5 border-b ${look.divider} flex items-center justify-between`}>
            <p className={`text-sm font-semibold ${look.heading}`}>Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className={`text-xs ${look.markAll} flex items-center gap-1`}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className={`flex items-center justify-center py-8 ${look.muted} text-sm`}>
                <Loader2 size={16} className="animate-spin mr-2" /> Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-6">
                <Bell size={20} className={`mx-auto ${look.emptyIcon} mb-2`} />
                <p className={`text-sm ${look.emptyTitle}`}>You're all caught up</p>
                <p className={`text-xs ${look.muted} mt-1`}>Invites and new members of your spaces show up here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <div
                    key={n._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpen(n)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpen(n)}
                    className={`group flex items-start gap-3 px-4 py-3 border-b ${look.divider} last:border-b-0 cursor-pointer ${look.row} transition-colors ${
                      n.read ? '' : look.rowUnread
                    }`}
                  >
                    <span className={`p-1.5 rounded-md shrink-0 ${n.read ? look.iconRead : look.iconUnread}`}>
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${n.read ? look.titleRead : look.titleUnread}`}>
                        {n.title}
                      </p>
                      {n.body && <p className={`text-xs ${look.body} mt-0.5 line-clamp-2`}>{n.body}</p>}
                      <p className={`text-[10px] ${look.muted} mt-1`}>{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(e, n)}
                      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 ${look.dismiss} ${look.touchVisible} p-0.5 rounded shrink-0 transition-opacity`}
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
