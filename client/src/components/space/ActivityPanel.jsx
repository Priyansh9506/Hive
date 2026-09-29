import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity as ActivityIcon, FilePlus2, Highlighter, Loader2, LogIn, LogOut,
  Mail, Pencil, Pin, RefreshCw, RotateCcw, Settings, Sparkles, Trash2, UserMinus,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import api from '../../lib/api';

const TYPE_ICON = {
  space_created: Sparkles,
  space_updated: Settings,
  member_joined: LogIn,
  member_left: LogOut,
  member_removed: UserMinus,
  notes_edited: Pencil,
  resource_added: FilePlus2,
  resource_deleted: Trash2,
  message_pinned: Pin,
  message_unpinned: Pin,
  highlight_created: Highlighter,
  highlight_deleted: Trash2,
  invite_sent: Mail,
  invite_regenerated: RefreshCw,
  snapshot_created: ActivityIcon,
  snapshot_restored: RotateCcw,
};

// Group entries under Today / Yesterday / an explicit date, which is how the
// PRD's example feed reads and what a late joiner actually scans for.
const dayLabel = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ActivityPanel({ spaceId }) {
  const socket = useSocket();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/activity?limit=50`);
      setActivities(res.data.activities);
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error('Failed to load activity', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (activity) => {
      if (String(activity.spaceId) !== String(spaceId)) return;
      setActivities((prev) => (prev.some((a) => a._id === activity._id) ? prev : [activity, ...prev]));
    };

    socket.on('activity_new', handleNew);
    return () => socket.off('activity_new', handleNew);
  }, [socket, spaceId]);

  const loadOlder = async () => {
    if (loadingMore || activities.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = activities[activities.length - 1].createdAt;
      const res = await api.get(`/spaces/${spaceId}/activity?limit=50&before=${oldest}`);
      setActivities((prev) => [...prev, ...res.data.activities]);
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error('Failed to load more activity', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Walk the (already newest-first) list and start a new group at each date change
  const groups = [];
  for (const activity of activities) {
    const label = dayLabel(activity.createdAt);
    if (groups.length === 0 || groups[groups.length - 1].label !== label) {
      groups.push({ label, items: [activity] });
    } else {
      groups[groups.length - 1].items.push(activity);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <ActivityIcon size={15} /> Activity
        </h3>
        <span className="text-xs text-gray-400">{activities.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading activity...
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <ActivityIcon size={22} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Joins, notes, resources and pins will show up here.
            </p>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 sticky top-0 bg-white py-1">
                  {group.label}
                </p>
                <ul className="space-y-2.5">
                  {group.items.map((activity) => {
                    const Icon = TYPE_ICON[activity.type] || ActivityIcon;
                    return (
                      <li key={activity._id} className="flex items-start gap-2.5">
                        <span className="text-[10px] text-gray-400 tabular-nums mt-0.5 w-10 shrink-0">
                          {timeLabel(activity.createdAt)}
                        </span>
                        <span className="p-1 rounded bg-gray-100 text-gray-500 shrink-0 mt-0.5">
                          <Icon size={11} />
                        </span>
                        <p className="text-xs text-gray-700 leading-relaxed min-w-0">
                          <span className="font-medium text-gray-900">{activity.userName}</span>{' '}
                          {activity.summary}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadOlder}
                disabled={loadingMore}
                className="w-full text-xs text-blue-600 hover:text-blue-800 py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingMore && <Loader2 size={13} className="animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load earlier activity'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
