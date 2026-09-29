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
import { useSocket, useSocketStatus } from '../context/SocketContext';
import api from '../lib/api';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../lib/motion';

const DESKTOP_QUERY = '(min-width: 768px)'; // Tailwind `md`
// Batch "I've read up to here" writes while messages keep arriving
const MARK_READ_DEBOUNCE_MS = 2000;

// The space navigation from PRD §11. `mobileOnly` entries are covered by the
// chat sidebar on desktop.
const TABS = [
  { id: 'notes', label: 'Shared Notes', icon: BookOpen },
  { id: 'chat', label: 'Discussion', icon: MessageSquare, mobileOnly: true },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'resources', label: 'Resources', icon: Paperclip },
  { id: 'pins', label: 'Pinned', icon: Pin },
  { id: 'highlights', label: 'Highlights', icon: Highlighter },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'history', label: 'Version history', icon: History },
];
const TAB_IDS = TABS.map((t) => t.id);

export default function WorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const socketStatus = useSocketStatus();
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
  const [chatOpen, setChatOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState(null);
  const [explainRequest, setExplainRequest] = useState(null); // { text, context } from the editor
  const [unread, setUnread] = useState(0);
  const markReadTimer = useRef(null);
  const centerRef = useRef(null);
  const chatSidebarRef = useRef(null);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading space...
      </div>
    );
  }
  if (!space) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>{loadError || 'Space not found or unauthorized.'}</p>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const userRole = space.userRole;
  const chatPanel = (
    <ChatPanel
      spaceId={spaceId}
      userRole={userRole}
      onHighlight={handleHighlight}
      jumpToMessageId={jumpToMessageId}
      onJumpHandled={handleJumpHandled}
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

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Topbar />

      {/* Workspace Header */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center shrink-0 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-full hover:bg-gray-100 shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{space.name}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <button
                onClick={() => setActiveTab('members')}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                <Users size={12} /> {space.membersCount} members
              </button>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">
                Join Code: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{space.joinCode}</code>
              </span>
              <span>•</span>
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

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Invite</span>
          </button>

          {/* Toggle chat panel button (desktop) */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="hidden md:flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors relative"
            title={chatOpen ? 'Hide chat' : 'Show chat'}
          >
            {chatOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            <span className="hidden lg:inline">{chatOpen ? 'Hide Chat' : 'Show Chat'}</span>
            {!chatOpen && unread > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar - Navigation */}
        <div className="w-14 sm:w-56 bg-white border-r flex flex-col shrink-0">
          <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = centerTab === tab.id;
              const badge = tab.id === 'chat' && unread > 0 ? unread : 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                    tab.mobileOnly ? 'md:hidden' : ''
                  } ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="hidden sm:block truncate">{tab.label}</span>
                  {badge > 0 && (
                    <span className="absolute top-1 right-1 sm:static sm:ml-auto min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center Content */}
        <div ref={centerRef} className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden flex flex-col min-w-0">
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

        {/* Right Sidebar — Chat Panel (desktop only). Exactly one ChatPanel is
            ever mounted, so there is one set of chat listeners per page. */}
        {isDesktop && chatOpen && (
          <div ref={chatSidebarRef} className="flex w-80 lg:w-96 shrink-0 border-l p-2">
            <div className="w-full">{chatPanel}</div>
          </div>
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
    </div>
  );
}
