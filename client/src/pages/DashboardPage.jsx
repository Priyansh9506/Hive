import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import Topbar from '../components/layout/Topbar';
import AppShell from '../components/layout/AppShell';
import { Plus, Users, ArrowRight, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { CreateSpaceModal } from '../components/space/CreateSpaceModal';
import { JoinSpaceModal } from '../components/space/JoinSpaceModal';
import { EditSpaceModal } from '../components/space/EditSpaceModal';
import { DeleteSpaceModal } from '../components/space/DeleteSpaceModal';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useReveal } from '../hooks/useReveal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { SpaceGlyph, spaceColor as colorOf } from '../lib/spaceIcons';

const PILL = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame';
const PILL_FLAME = `${PILL} bg-flame text-flame-ink hover:opacity-90`;
const PILL_GHOST = `${PILL} border border-line bg-surface text-ink hover:bg-sunk`;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Small dropdown menu component
function SpaceMenu({ space, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (space.userRole !== 'owner') return null;

  return (
    // Sits above the card's full-size link so it stays clickable
    <div className="relative z-10" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-full text-ink-faint hover:text-ink hover:bg-sunk transition-colors cursor-pointer"
        aria-label={`Options for ${space.name}`}
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-surface border border-line rounded-xl ls-lift py-1 w-40">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-sunk transition-colors cursor-pointer"
          >
            <Pencil size={14} /> Edit space
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete space
          </button>
        </div>
      )}
    </div>
  );
}

function SpaceCard({ space, onEdit, onDelete }) {
  const spaceColor = colorOf(space);
  const id = space._id || space.id;

  return (
    <article className="ls-card group relative flex flex-col rounded-2xl border border-line bg-surface p-5">
      {/* The whole card opens the space; the menu above it is the exception */}
      <Link
        to={`/spaces/${id}`}
        aria-label={`Open ${space.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
      />

      <div className="flex items-start justify-between">
        <div
          className="size-11 rounded-xl grid place-items-center shadow-sm"
          style={{ backgroundColor: spaceColor }}
        >
          <SpaceGlyph icon={space.icon} size={21} className="text-white" />
        </div>
        <SpaceMenu space={space} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink line-clamp-1" title={space.name}>
        {space.name}
      </h3>
      <p className="mt-1 text-sm text-ink-soft line-clamp-2 min-h-[2.5rem]">
        {space.description || 'No description yet.'}
      </p>

      <div className="mt-5 pt-4 border-t border-line flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-sunk text-ink-soft px-2 py-1 rounded-full">
            <Users size={12} /> {space.membersCount}
          </span>
          {space.unreadCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium bg-flame-wash text-flame px-2 py-1 rounded-full"
              title="Messages since you last read the discussion"
            >
              <MessageSquare size={12} /> {space.unreadCount > 99 ? '99+' : space.unreadCount} new
            </span>
          )}
          <span className="text-xs text-ink-faint truncate">
            {new Date(space.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <span aria-hidden="true" className="inline-flex items-center gap-1 text-sm font-medium text-ink-faint group-hover:text-flame transition-colors shrink-0">
          Open <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [deletingSpace, setDeletingSpace] = useState(null);
  const gridRef = useRef(null);

  // Cards rise in once loaded; a newly created or joined space animates on its own
  useReveal(gridRef, { deps: [loading, spaces.length], y: 18, stagger: 0.07 });

  const fetchSpaces = useCallback(async () => {
    try {
      const response = await api.get('/spaces');
      setSpaces(response.data.spaces);
    } catch (error) {
      console.error('Failed to fetch spaces', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  // A new card, or a fresher copy of one already shown (the socket event and
  // the HTTP response for the same space can arrive in either order)
  const upsert = (space) =>
    setSpaces((prev) => {
      const id = String(space._id || space.id);
      return prev.some((s) => String(s._id || s.id) === id)
        ? prev.map((s) => (String(s._id || s.id) === id ? { ...s, ...space } : s))
        : [space, ...prev];
    });

  // ---------- Live updates ----------
  // The server keeps this socket in a watch room for each of the user's spaces
  // (server/utils/live.js), so cards follow joins, edits, deletions and new
  // messages as they happen.
  useEffect(() => {
    if (!socket) return;
    const same = (id) => (s) => String(s._id || s.id) === String(id);
    const patch = (id, fn) => setSpaces((prev) => prev.map((s) => (same(id)(s) ? { ...s, ...fn(s) } : s)));
    const drop = (id) => setSpaces((prev) => prev.filter((s) => !same(id)(s)));

    const handleUpdated = ({ spaceId, ...changes }) => patch(spaceId, () => changes);
    const handleCount = ({ spaceId, membersCount }) => {
      if (membersCount != null) patch(spaceId, () => ({ membersCount }));
    };
    const handleMessage = ({ spaceId, senderId }) => {
      if (String(senderId) !== String(user?.id)) patch(spaceId, (s) => ({ unreadCount: (s.unreadCount || 0) + 1 }));
    };
    const handleRead = ({ spaceId }) => patch(spaceId, () => ({ unreadCount: 0 }));
    const handleAdded = ({ space }) => upsert(space);
    const handleDeleted = ({ spaceId, name, deletedBy }) => {
      drop(spaceId);
      if (String(deletedBy) !== String(user?.id)) toast(`"${name}" was deleted by its owner`);
    };
    const handleGone = ({ spaceId }) => drop(spaceId);
    const handleRevoked = ({ spaceId }) => {
      drop(spaceId);
      toast.error('You were removed from a study space');
    };

    const events = {
      space_updated: handleUpdated,
      member_joined: handleCount,
      member_removed: handleCount,
      space_message: handleMessage,
      space_read: handleRead,
      space_added: handleAdded,
      space_deleted: handleDeleted,
      space_removed: handleGone,
      space_access_revoked: handleRevoked,
    };
    Object.entries(events).forEach(([name, fn]) => socket.on(name, fn));
    // Anything that happened while disconnected: take the server's word for it
    socket.io.on('reconnect', fetchSpaces);
    return () => {
      Object.entries(events).forEach(([name, fn]) => socket.off(name, fn));
      socket.io.off('reconnect', fetchSpaces);
    };
  }, [socket, user?.id, fetchSpaces]);

  // Coming back to the tab after a while: catch up quietly
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && fetchSpaces();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchSpaces]);

  const handleSpaceCreated = upsert;
  const handleSpaceJoined = upsert;

  const handleSpaceUpdated = (updatedSpace) => {
    setSpaces((prev) =>
      prev.map((s) => ((s._id || s.id) === (updatedSpace._id || updatedSpace.id) ? updatedSpace : s))
    );
  };

  const handleSpaceDeleted = (spaceId) => {
    setSpaces((prev) => prev.filter((s) => (s._id || s.id) !== spaceId));
  };

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const unread = spaces.reduce((sum, s) => sum + (s.unreadCount || 0), 0);
  const summary = loading
    ? ' '
    : spaces.length === 0
      ? 'Set up your first study space, or join one with an invite code.'
      : `${plural(spaces.length, 'study space')} · ${unread > 0 ? `${plural(unread, 'new message')} waiting` : 'all caught up'}`;

  return (
    <AppShell className="min-h-[100dvh] flex flex-col">
      <Topbar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-6 sm:pt-10 pb-16">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-10 gap-5 sm:gap-6">
          <div>
            <p className="text-sm text-ink-faint">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 font-display text-[2.5rem] sm:text-5xl leading-[1.05] tracking-tight text-ink">
              {greeting()}{firstName && <>, <span className="italic">{firstName}</span></>}
            </h1>
            <p className="mt-2 text-ink-soft">{summary}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" className={`${PILL_GHOST} flex-1 sm:flex-none`} onClick={() => setIsJoinModalOpen(true)}>
              <Users size={16} /> Join space
            </button>
            <button type="button" className={`${PILL_FLAME} flex-1 sm:flex-none`} onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={16} /> New space
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-5 animate-pulse">
                <div className="size-11 rounded-xl bg-sunk" />
                <div className="mt-4 h-5 w-2/3 rounded bg-sunk" />
                <div className="mt-3 h-3.5 w-full rounded bg-sunk" />
                <div className="mt-2 h-3.5 w-4/5 rounded bg-sunk" />
                <div className="mt-6 h-6 w-1/3 rounded-full bg-sunk" />
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-line bg-surface">
            <div className="mx-auto size-14 rounded-2xl bg-flame-wash text-flame grid place-items-center mb-5">
              <Users size={24} />
            </div>
            <h2 className="font-display text-3xl text-ink">Your desk is clear</h2>
            <p className="mt-2 text-ink-soft max-w-md mx-auto">
              A study space holds shared notes, a discussion and your resources. Start one for a course, or join a classmate's with their invite code.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <button type="button" className={PILL_FLAME} onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={16} /> Create a space
              </button>
              <button type="button" className={PILL_GHOST} onClick={() => setIsJoinModalOpen(true)}>
                Join with a code
              </button>
            </div>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
            {spaces.map((space) => (
              <SpaceCard
                key={space._id || space.id}
                space={space}
                onEdit={() => setEditingSpace(space)}
                onDelete={() => setDeletingSpace(space)}
              />
            ))}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="group min-h-[13rem] rounded-2xl border border-dashed border-line flex flex-col items-center justify-center gap-3 text-ink-faint hover:text-ink hover:border-ink-faint hover:bg-surface transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
            >
              <span className="size-11 rounded-full border border-line bg-surface grid place-items-center transition-colors group-hover:bg-flame group-hover:border-flame group-hover:text-flame-ink">
                <Plus size={20} />
              </span>
              <span className="text-sm font-medium">New study space</span>
            </button>
          </div>
        )}
      </main>

      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleSpaceCreated}
      />

      <JoinSpaceModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleSpaceJoined}
      />

      <EditSpaceModal
        isOpen={!!editingSpace}
        onClose={() => setEditingSpace(null)}
        space={editingSpace}
        onUpdate={handleSpaceUpdated}
      />

      <DeleteSpaceModal
        isOpen={!!deletingSpace}
        onClose={() => setDeletingSpace(null)}
        space={deletingSpace}
        onDelete={handleSpaceDeleted}
      />
    </AppShell>
  );
}
