import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import CollaborativeEditor from '../components/space/CollaborativeEditor';
import ChatPanel from '../components/space/ChatPanel';
import { ArrowLeft, Users, MessageSquare, BookOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import api from '../lib/api';

export default function WorkspacePage() {
  const { id } = useParams();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'chat'
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    const fetchSpace = async () => {
      try {
        const res = await api.get(`/spaces/${id}`);
        setSpace(res.data.space);
      } catch (err) {
        console.error('Failed to load space', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpace();
  }, [id]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading space...</div>;
  if (!space) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Space not found or unauthorized.</div>;

  const spaceId = space._id || space.id;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Topbar />
      
      {/* Workspace Header */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{space.name}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={12} /> {space.membersCount} members</span>
              <span>•</span>
              <span>Join Code: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{space.joinCode}</code></span>
              <span>•</span>
              <span className="text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                Auto-saving
              </span>
            </div>
          </div>
        </div>

        {/* Toggle chat panel button (desktop) */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="hidden md:flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title={chatOpen ? 'Hide chat' : 'Show chat'}
        >
          {chatOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          <span className="hidden lg:inline">{chatOpen ? 'Hide Chat' : 'Show Chat'}</span>
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar - Navigation */}
        <div className="w-14 sm:w-56 bg-white border-r flex flex-col shrink-0">
          <nav className="p-2 space-y-1 flex-1">
            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'notes'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={18} />
              <span className="hidden sm:block">Shared Notes</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors md:hidden ${
                activeTab === 'chat'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare size={18} />
              <span className="hidden sm:block">Discussion</span>
            </button>
          </nav>
        </div>

        {/* Center Content — Notes or Chat on mobile */}
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden flex flex-col">
          {activeTab === 'notes' ? (
            <CollaborativeEditor spaceId={spaceId} initialNotes={space.notesContent || ''} />
          ) : (
            <div className="md:hidden h-full">
              <ChatPanel spaceId={spaceId} />
            </div>
          )}
        </div>

        {/* Right Sidebar — Chat Panel (desktop only) */}
        {chatOpen && (
          <div className="hidden md:flex w-80 lg:w-96 shrink-0 border-l p-2">
            <div className="w-full">
              <ChatPanel spaceId={spaceId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
