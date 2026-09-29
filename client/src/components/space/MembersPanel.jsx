import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Loader2, LogOut, UserMinus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

// Stable per-name colour so a member keeps the same avatar tint across renders
const AVATAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
const colorFor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function MembersPanel({ spaceId, userRole, onLeft }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [online, setOnline] = useState([]); // user ids currently connected
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/members`);
      setMembers(res.data.members);
    } catch (err) {
      console.error('Failed to load members', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    setLoading(true);
    loadMembers();
  }, [loadMembers]);

  // ---------- Presence ----------
  useEffect(() => {
    if (!socket) return;

    // The server sends the full online list when this socket joins the room
    const handlePresence = ({ spaceId: id, online: list }) => {
      if (String(id) !== String(spaceId)) return;
      setOnline(list.map((u) => String(u.userId)));
    };

    const handleJoined = ({ userId }) => {
      setOnline((prev) => (prev.includes(String(userId)) ? prev : [...prev, String(userId)]));
      // A first-time joiner is not in the member list yet
      loadMembers();
    };

    const handleLeft = ({ userId }) => {
      setOnline((prev) => prev.filter((id) => id !== String(userId)));
    };

    const handleRemoved = ({ userId }) => {
      setMembers((prev) => prev.filter((m) => String(m.userId) !== String(userId)));
      setOnline((prev) => prev.filter((id) => id !== String(userId)));
    };

    socket.on('presence_state', handlePresence);
    socket.on('user_joined', handleJoined);
    socket.on('user_left', handleLeft);
    socket.on('member_removed', handleRemoved);

    // The workspace joined the room before this panel mounted, so the
    // presence_state sent on join has already gone by — ask for it now
    socket.emit('presence_request', spaceId, ({ online: list } = {}) => {
      if (list) setOnline(list.map((u) => String(u.userId)));
    });

    return () => {
      socket.off('presence_state', handlePresence);
      socket.off('user_joined', handleJoined);
      socket.off('user_left', handleLeft);
      socket.off('member_removed', handleRemoved);
    };
  }, [socket, spaceId, loadMembers]);

  // ---------- Actions ----------
  const handleRemove = async (member) => {
    setRemoving(member.userId);
    try {
      await api.delete(`/spaces/${spaceId}/members/${member.userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      toast.success(`${member.name} removed`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await api.post(`/spaces/${spaceId}/leave`);
      toast.success('You have left this space');
      onLeft?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave space');
      setLeaving(false);
    }
  };

  const isOnline = (member) => online.includes(String(member.userId));
  const onlineCount = members.filter(isOnline).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Users size={15} /> Members
        </h3>
        <span className="text-xs text-gray-400">
          {onlineCount} of {members.length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading members...
          </div>
        ) : (
          <ul className="space-y-0.5">
            {members.map((member) => {
              const self = String(member.userId) === String(user.id);
              return (
                <li
                  key={member.userId}
                  className="group flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="relative shrink-0">
                    <span
                      className="h-8 w-8 rounded-full text-xs font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: colorFor(member.name) }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${
                        isOnline(member) ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                      title={isOnline(member) ? 'Online' : 'Offline'}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                      {member.name}
                      {self && <span className="text-[10px] text-gray-400 font-normal">(you)</span>}
                      {member.role === 'owner' && (
                        <Crown size={11} className="text-amber-500 shrink-0" title="Space owner" />
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                  </div>

                  {/* Only the owner manages members, and never themselves (PRD §22) */}
                  {userRole === 'owner' && !self && (
                    <button
                      onClick={() => handleRemove(member)}
                      disabled={removing === member.userId}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-rose-600 p-1 rounded transition-all disabled:opacity-50"
                      title={`Remove ${member.name}`}
                    >
                      {removing === member.userId ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserMinus size={14} />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* The owner has no Leave action: they delete or keep the space */}
      {userRole !== 'owner' && (
        <div className="border-t p-2 shrink-0">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full flex items-center justify-center gap-2 text-xs text-rose-600 hover:bg-rose-50 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            Leave this space
          </button>
        </div>
      )}
    </div>
  );
}
