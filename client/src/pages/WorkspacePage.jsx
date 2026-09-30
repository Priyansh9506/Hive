import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Topbar from '../components/layout/Topbar';
import CollaborativeEditor from '../components/space/CollaborativeEditor';
import ChatPanel from '../components/space/ChatPanel';
import ResourcesPanel from '../components/space/ResourcesPanel';
import PinsPanel from '../components/space/PinsPanel';
import HighlightsPanel from '../components/space/HighlightsPanel';
import ActivityPanel from '../components/space/ActivityPanel';
import MembersPanel from '../components/space/MembersPanel';
import VersionsPanel from '../components/space/VersionsPanel';
import AIPanel from '../components/space/AIPanel';
import InviteModal from '../components/space/InviteModal';
import HighlightModal from '../components/space/HighlightModal';
import {
  ArrowLeft, Users, MessageSquare, BookOpen, PanelRightClose, PanelRightOpen,
  Paperclip, Pin, Highlighter, Activity, History, UserPlus, Loader2, Wifi, WifiOff, Sparkles,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { SpaceGlyph, spaceColor } from '../lib/spaceIcons';
import { useSocket, useSocketStatus } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../lib/motion';

// Layout by width:
//   < md        phones: tab strip on top, the chat is one of the tabs
//   md .. lg    tablets upright: icon rail, the chat slides over from the right
//   lg .. xl    tablets sideways, small laptops: icon rail, chat docked
//   xl+         desktop: labelled sidebar, wider docked chat
const DESKTOP_QUERY = '(min-width: 768px)'; // Tailwind `md`
const DOCKED_CHAT_QUERY = '(min-width: 1024px)'; // Tailwind `lg`
// Batch "I've read up to here" writes while messages keep arriving
const MARK_READ_DEBOUNCE_MS = 2000;

// The space navigation from PRD §11. `mobileOnly` entries are covered by the
// chat sidebar on desktop.
const TABS = [
  { id: 'notes', label: 'Shared Notes', short: 'Notes', icon: BookOpen },
  { id: 'chat', label: 'Discussion', short: 'Chat', icon: MessageSquare, mobileOnly: true },
  { id: 'ai', label: 'AI Assistant', short: 'AI', icon: Sparkles },
  { id: 'resources', label: 'Resources', short: 'Files', icon: Paperclip },
  { id: 'pins', label: 'Pinned', short: 'Pinned', icon: Pin },
  { id: 'highlights', label: 'Highlights', short: 'Highlights', icon: Highlighter },
  { id: 'activity', label: 'Activity', short: 'Activity', icon: Activity },
  { id: 'members', label: 'Members', short: 'Members', icon: Users },
  { id: 'history', label: 'Version history', short: 'History', icon: History },
];

const Badge = ({ count, className = '' }) => (
  <span className={`min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center ${className}`}>
    {count > 99 ? '99+' : count}
  </span>
);
const TAB_IDS = TABS.map((t) => t.id);

export default function WorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const socketStatus = useSocketStatus();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // A search result can deep-link to a panel (?tab=) or a message (?message=)
  const [activeTab, setActiveTab] = useState(() => {
    if (searchParams.get('message')) return 'chat';
    const tab = searchParams.get('tab');
    return TAB_IDS.includes(tab) ? tab : 'notes';
  });
  const [jumpToMessageId, setJumpToMessageId] = useState(() => searchParams.get('message'));
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [chatDocked, setChatDocked] = useState(() => window.matchMedia(DOCKED_CHAT_QUERY).matches);
  // Docked chat starts open; the slide-over one waits to be asked for
  const [chatOpen, setChatOpen] = useState(() => window.matchMedia(DOCKED_CHAT_QUERY).matches);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState(null);
  const [explainRequest, setExplainRequest] = useState(null); // { text, context } from the editor
  const [unread, setUnread] = useState(0);
  const markReadTimer = useRef(null);
  const centerRef = useRef(null);
  const chatSidebarRef = useRef(null);
  const tabStripRef = useRef(null);

  // The deep link has been read into state; drop it so a refresh does not replay it
  useEffect(() => {
    if (searchParams.has('tab') || searchParams.has('message')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Turning a tablet upright turns the docked chat into a slide-over; close it
  // rather than cover the notes, and reopen it when there is room again
  useEffect(() => {
    const mq = window.matchMedia(DOCKED_CHAT_QUERY);
    const onChange = (e) => {
      setChatDocked(e.matches);
      setChatOpen(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const fetchSpace = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await api.get(`/spaces/${id}`);
        setSpace(res.data.space);
      } catch (err) {
        console.error('Failed to load space', err);
        setLoadError(err.response?.data?.message || 'Space not found or unauthorized.');
      } finally {
        setLoading(false);
      }
    };
    fetchSpace();
  }, [id]);

  const spaceId = space?._id || space?.id;

  // On desktop the chat lives in the sidebar, so a "chat" tab means the notes
  const centerTab = isDesktop && activeTab === 'chat' ? 'notes' : activeTab;
  const chatVisible = isDesktop ? chatOpen : centerTab === 'chat';

  // ---------- Room membership ----------
  // Joined here rather than in any one panel: the panels come and go with the
  // selected tab, but all of them need the room's live events.
  useEffect(() => {
    if (!socket || !spaceId) return;

    const join = () => {
      socket.emit('join_space', spaceId, (res) => {
        if (res && !res.ok) console.warn('Could not join space room:', res.error);
      });
    };

    // A reconnect starts the socket in no rooms, so re-join on every connect
    if (socket.connected) join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
      socket.emit('leave_space', spaceId);
    };
  }, [socket, spaceId]);

  // ---------- Losing access ----------
  useEffect(() => {
    if (!socket || !spaceId) return;

    const leave = (message) => {
      toast.error(message);
      navigate('/dashboard', { replace: true });
    };
    const handleRevoked = ({ spaceId: gone }) => {
      if (String(gone) === String(spaceId)) leave('You were removed from this space');
    };
    const handleDeleted = ({ spaceId: gone, name }) => {
      if (String(gone) === String(spaceId)) leave(`"${name}" was deleted by its owner`);
    };

    socket.on('space_access_revoked', handleRevoked);
    socket.on('space_deleted', handleDeleted);
    return () => {
      socket.off('space_access_revoked', handleRevoked);
      socket.off('space_deleted', handleDeleted);
    };
  }, [socket, spaceId, navigate]);

  // ---------- Live header ----------
  // Name, member count and join code follow changes made anywhere, so nobody
  // has to reload to see that someone joined or the owner renamed the space
  const userRole = space?.userRole;
  useEffect(() => {
    if (!socket || !spaceId) return;
    const mine = (id) => String(id) === String(spaceId);

    const handleUpdated = ({ spaceId: id, ...changes }) => {
      if (mine(id)) setSpace((s) => (s ? { ...s, ...changes } : s));
    };
    const handleCount = ({ spaceId: id, membersCount }) => {
      if (mine(id) && membersCount != null) setSpace((s) => (s ? { ...s, membersCount } : s));
    };
    const handleMemberJoined = (event) => {
      handleCount(event);
      const { spaceId: id, member } = event;
      // The owner already gets this as a notification
      if (mine(id) && member && String(member.userId) !== String(user?.id) && userRole !== 'owner') {
        toast(`${member.name} joined the space`, { icon: '👋' });
      }
    };
    // Changes made while the connection was down arrive as nothing: re-read
    const resync = () =>
      api.get(`/spaces/${spaceId}`).then((res) => setSpace(res.data.space)).catch(() => {});

    socket.on('space_updated', handleUpdated);
    socket.on('member_joined', handleMemberJoined);
    socket.on('member_removed', handleCount);
    socket.io.on('reconnect', resync);
    return () => {
      socket.off('space_updated', handleUpdated);
      socket.off('member_joined', handleMemberJoined);
      socket.off('member_removed', handleCount);
      socket.io.off('reconnect', resync);
    };
  }, [socket, spaceId, user?.id, userRole]);

  // ---------- Unread (PRD §14) ----------
  const markRead = useCallback(
    (delay = 0) => {
      if (!spaceId) return;
      clearTimeout(markReadTimer.current);
      markReadTimer.current = setTimeout(() => {
        markReadTimer.current = null;
        api.post(`/spaces/${spaceId}/read`).catch(() => {});
      }, delay);
    },
    [spaceId]
  );

  // Opening the chat catches up on everything in it
  useEffect(() => {
    if (chatVisible && spaceId) {
      setUnread(0);
      markRead();
    }
  }, [chatVisible, spaceId, markRead]);

  // Flush a pending write when leaving the space
  useEffect(
    () => () => {
      if (markReadTimer.current && spaceId) {
        clearTimeout(markReadTimer.current);
        api.post(`/spaces/${spaceId}/read`).catch(() => {});
      }
    },
    [spaceId]
  );

  useEffect(() => {
    if (!socket || !spaceId) return;
    const handleMessage = (msg) => {
      if (String(msg.spaceId) !== String(spaceId)) return;
      // A message in an open, focused chat has been seen; otherwise it is unread
      if (chatVisible && !document.hidden) {
        markRead(MARK_READ_DEBOUNCE_MS);
      } else {
        setUnread((n) => n + 1);
      }
    };
    socket.on('receive_message', handleMessage);
    return () => socket.off('receive_message', handleMessage);
  }, [socket, spaceId, chatVisible, markRead]);

  // Coming back to a background tab with the chat open counts as reading it
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && chatVisible) {
        setUnread(0);
        markRead();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [chatVisible, markRead]);

  const chatOverlay = isDesktop && !chatDocked && chatOpen;
  useEffect(() => {
    if (!chatOverlay) return;
    const onKey = (e) => e.key === 'Escape' && setChatOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chatOverlay]);

  // Phones: keep the selected tab in view in the scrolling strip
  useEffect(() => {
    tabStripRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [centerTab]);

  // ---------- Cross-panel actions ----------
  const openChat = () => (isDesktop ? setChatOpen(true) : setActiveTab('chat'));

  const handleJumpToMessage = (messageId) => {
    setJumpToMessageId(messageId);
    openChat();
  };
  const handleJumpHandled = useCallback(() => setJumpToMessageId(null), []);

  const handleHighlight = useCallback((target) => setHighlightTarget(target), []);
  const handleNotesHighlight = useCallback(
    (text) => setHighlightTarget({ sourceType: 'notes', text }),
    []
  );

  // "Explain" in the notes hands the selection to the AI assistant
  const handleExplain = useCallback((text, context) => {
    setExplainRequest({ text, context });
    setActiveTab('ai');
  }, []);
  const handleExplainHandled = useCallback(() => setExplainRequest(null), []);

  // ---------- Motion ----------
  // Switching tabs eases the newly shown panel in. The first panel is left to
  // the page transition, so the two do not stack.
  const shownTab = useRef(null);
  useGSAP(
    () => {
      const previous = shownTab.current;
      shownTab.current = centerTab;
      if (previous === null || previous === centerTab || prefersReducedMotion()) return;

      const panel = centerRef.current?.querySelector(':scope > :not(.hidden)');
      if (!panel) return;
      gsap.fromTo(panel, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, overwrite: true, clearProps: CLEAR });
    },
    { dependencies: [centerTab] }
  );

  // Reopening the chat slides it in from the edge it lives on
  useGSAP(
    () => {
      if (!chatOpen || !chatSidebarRef.current || prefersReducedMotion()) return;
      gsap.fromTo(chatSidebarRef.current, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.35, clearProps: CLEAR });
    },
    { dependencies: [chatOpen] }
  );

  if (loading) {
    return (
      <AppShell className="min-h-[100dvh] flex items-center justify-center text-ink-faint gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading space...
      </AppShell>
    );
  }
  if (!space) {
    return (
      <AppShell className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 px-6 text-center text-ink-soft">
        <p>{loadError || 'Space not found or unauthorized.'}</p>
        <Link to="/dashboard" className="text-sm text-flame hover:underline">Back to dashboard</Link>
      </AppShell>
    );
  }

  const chatPanel = (
    <ChatPanel
      spaceId={spaceId}
      userRole={userRole}
      onHighlight={handleHighlight}
      jumpToMessageId={jumpToMessageId}
      onJumpHandled={handleJumpHandled}
      onClose={isDesktop && !chatDocked ? () => setChatOpen(false) : undefined}
    />
  );

  const renderPanel = () => {
    switch (centerTab) {
      case 'chat':
        return chatPanel;
      case 'resources':
        return <ResourcesPanel spaceId={spaceId} userRole={userRole} />;
      case 'pins':
        return <PinsPanel spaceId={spaceId} userRole={userRole} onJumpToMessage={handleJumpToMessage} />;
      case 'highlights':
        return <HighlightsPanel spaceId={spaceId} userRole={userRole} />;
      case 'activity':
        return <ActivityPanel spaceId={spaceId} />;
      case 'members':
        return (
          <MembersPanel
            spaceId={spaceId}
            userRole={userRole}
            onLeft={() => navigate('/dashboard', { replace: true })}
          />
        );
      case 'history':
        return <VersionsPanel spaceId={spaceId} onRestored={() => setActiveTab('notes')} />;
      default:
        return null;
    }
  };

  const chatToggleLabel = chatOpen ? 'Hide chat' : 'Show chat';

  return (
    <AppShell className="h-[100dvh] flex flex-col overflow-hidden">
      {/* A phone held sideways has no height to spare; the header below still
          leads back to the dashboard */}
      <Topbar className="[@media(max-height:520px)]:hidden" />

      {/* Workspace Header */}
      <div className="bg-surface border-b border-line px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center shrink-0 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="text-ink-faint hover:text-ink transition-colors p-1.5 rounded-full hover:bg-sunk shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div
            className="hidden sm:grid size-9 rounded-xl place-items-center shrink-0 shadow-sm"
            style={{ backgroundColor: spaceColor(space) }}
          >
            <SpaceGlyph icon={space.icon} size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-ink truncate">{space.name}</h2>
            <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint flex-wrap">
              <button
                onClick={() => setActiveTab('members')}
                className="flex items-center gap-1 hover:text-ink cursor-pointer"
              >
                <Users size={12} /> {space.membersCount} <span className="hidden min-[400px]:inline">members</span>
              </button>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                Code <code className="bg-sunk px-1.5 py-0.5 rounded-md text-ink-soft font-geist-mono">{space.joinCode}</code>
              </span>
              <span>·</span>
              {/* PRD §21: say plainly whether live updates are flowing */}
              {socketStatus === 'connected' ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <Wifi size={12} /> Connected
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1" title="Your edits are kept and will sync when the connection returns">
                  <WifiOff size={12} /> Reconnecting...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setInviteOpen(true)}
            aria-label="Invite"
            className="flex items-center gap-1.5 text-sm font-medium bg-flame text-flame-ink hover:opacity-90 h-9 px-3 sm:px-4 rounded-full transition-opacity cursor-pointer"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Invite</span>
          </button>

          {/* Chat toggle (tablet and up; on phones the chat is a tab) */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`hidden md:flex items-center gap-1.5 text-sm h-9 px-3 rounded-full border border-line transition-colors cursor-pointer ${
              chatOpen ? 'bg-sunk text-ink' : 'text-ink-soft hover:text-ink hover:bg-sunk'
            }`}
            title={chatToggleLabel}
            aria-label={chatToggleLabel}
            aria-expanded={chatOpen}
          >
            {chatOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            <span className="hidden xl:inline">{chatToggleLabel}</span>
            {!chatOpen && unread > 0 && <Badge count={unread} />}
          </button>
        </div>
      </div>

      {/* Phones: scrolling tab strip */}
      <nav
        ref={tabStripRef}
        aria-label="Space sections"
        className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-2 py-1.5 bg-surface border-b border-line shrink-0"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = centerTab === tab.id;
          const badge = tab.id === 'chat' && unread > 0 ? unread : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-sunk'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {tab.short}
              {badge > 0 && <Badge count={badge} />}
            </button>
          );
        })}
      </nav>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Tablet and up: icon rail, labelled from xl */}
        <div className="hidden md:flex w-16 xl:w-56 bg-surface border-r border-line flex-col shrink-0">
          <nav aria-label="Space sections" className="p-2 space-y-1 flex-1 overflow-y-auto no-scrollbar">
            {TABS.filter((tab) => !tab.mobileOnly).map((tab) => {
              const Icon = tab.icon;
              const active = centerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  aria-label={tab.label}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center justify-center xl:justify-start gap-3 h-11 xl:h-10 px-3 rounded-xl font-medium text-sm transition-colors cursor-pointer ${
                    active ? 'bg-flame-wash text-flame' : 'text-ink-soft hover:bg-sunk hover:text-ink'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="hidden xl:block truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center Content */}
        <div ref={centerRef} className="flex-1 p-2 sm:p-3 lg:p-4 xl:p-6 overflow-hidden flex flex-col min-w-0">
          {/* The editor stays mounted while other panels are shown, so its live
              connection, cursor presence and unsaved edits survive a tab switch */}
          <div className={centerTab === 'notes' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <CollaborativeEditor
              spaceId={spaceId}
              initialNotes={space.notesContent || ''}
              onHighlight={handleNotesHighlight}
              onExplain={handleExplain}
            />
          </div>
          {/* Kept mounted too, so answers, a quiz in progress and pending
              requests are not lost when switching tabs */}
          <div className={centerTab === 'ai' ? 'flex-1 min-h-0' : 'hidden'}>
            <AIPanel
              spaceId={spaceId}
              explainRequest={explainRequest}
              onExplainHandled={handleExplainHandled}
            />
          </div>
          {centerTab !== 'notes' && centerTab !== 'ai' && <div className="flex-1 min-h-0">{renderPanel()}</div>}
        </div>

        {/* Chat beside the notes (tablet and up). Docked from lg; below that it
            slides over the page. Exactly one ChatPanel is ever mounted, so
            there is one set of chat listeners per page. */}
        {isDesktop && chatOpen && (
          <>
            {chatOverlay && (
              <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setChatOpen(false)}
                aria-hidden="true"
              />
            )}
            <aside
              ref={chatSidebarRef}
              aria-label="Discussion"
              className={
                chatOverlay
                  ? 'fixed inset-y-0 right-0 z-50 w-[min(24rem,92vw)] flex flex-col bg-paper border-l border-line shadow-2xl'
                  : 'flex flex-col w-80 xl:w-96 shrink-0 border-l border-line p-2'
              }
            >
              <div className={`w-full flex-1 min-h-0 ${chatOverlay ? 'p-2' : ''}`}>{chatPanel}</div>
            </aside>
          </>
        )}
      </div>

      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        spaceId={spaceId}
        spaceName={space.name}
        userRole={userRole}
      />

      <HighlightModal
        isOpen={!!highlightTarget}
        onClose={() => setHighlightTarget(null)}
        spaceId={spaceId}
        target={highlightTarget}
      />
    </AppShell>
  );
}
