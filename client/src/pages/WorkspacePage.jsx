import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import CollaborativeEditor from '../components/space/CollaborativeEditor';
import { ArrowLeft, Users, MessageSquare, BookOpen } from 'lucide-react';
import api from '../lib/api';

export default function WorkspacePage() {
  const { id } = useParams();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading space...</div>;
  if (!space) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Space not found or unauthorized.</div>;

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
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar - Navigation (Mocked for now) */}
        <div className="w-16 sm:w-64 bg-white border-r flex flex-col shrink-0">
          <nav className="p-2 space-y-1 flex-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 bg-blue-50 text-blue-700 rounded-md font-medium text-sm transition-colors">
              <BookOpen size={18} />
              <span className="hidden sm:block">Shared Notes</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors opacity-50 cursor-not-allowed" title="Coming soon">
              <MessageSquare size={18} />
              <span className="hidden sm:block">Discussion (Soon)</span>
            </button>
          </nav>
        </div>

        {/* Center Canvas (Quill Editor) */}
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden flex flex-col">
          <CollaborativeEditor spaceId={space._id || space.id} />
        </div>

      </div>
    </div>
  );
}
