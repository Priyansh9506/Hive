import React, { useState, useEffect, useRef } from 'react';
import Topbar from '../components/layout/Topbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Users, ArrowRight, MoreVertical, Pencil, Trash2, Book, Code, FlaskConical, Calculator, PenLine, Globe, Lightbulb, Music, Palette, Rocket, Brain, GraduationCap } from 'lucide-react';
import { CreateSpaceModal } from '../components/space/CreateSpaceModal';
import { JoinSpaceModal } from '../components/space/JoinSpaceModal';
import { EditSpaceModal } from '../components/space/EditSpaceModal';
import { DeleteSpaceModal } from '../components/space/DeleteSpaceModal';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const ICON_MAP = {
  book: Book,
  code: Code,
  flask: FlaskConical,
  calculator: Calculator,
  pen: PenLine,
  globe: Globe,
  lightbulb: Lightbulb,
  music: Music,
  palette: Palette,
  rocket: Rocket,
  brain: Brain,
  graduation: GraduationCap,
};

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
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-full hover:bg-white/30 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 animate-in fade-in">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} /> Edit Space
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete Space
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [deletingSpace, setDeletingSpace] = useState(null);

  useEffect(() => {
    const fetchSpaces = async () => {
      setLoading(true);
      try {
        const response = await api.get('/spaces');
        setSpaces(response.data.spaces);
      } catch (error) {
        console.error('Failed to fetch spaces', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpaces();
  }, []);

  const handleSpaceCreated = (newSpace) => {
    setSpaces([newSpace, ...spaces]);
  };

  const handleSpaceJoined = (joinedSpace) => {
    setSpaces([joinedSpace, ...spaces]);
  };

  const handleSpaceUpdated = (updatedSpace) => {
    setSpaces((prev) =>
      prev.map((s) => ((s._id || s.id) === (updatedSpace._id || updatedSpace.id) ? updatedSpace : s))
    );
  };

  const handleSpaceDeleted = (spaceId) => {
    setSpaces((prev) => prev.filter((s) => (s._id || s.id) !== spaceId));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Topbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Study Spaces</h1>
            <p className="text-gray-500 mt-1">Collaborate, learn, and grow together.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={() => setIsJoinModalOpen(true)}
            >
              <Users size={18} /> Join Space
            </Button>
            <Button 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={18} /> New Space
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg border border-gray-100"></div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No study spaces yet</h3>
            <p className="mt-1 text-gray-500 max-w-md mx-auto">
              Get started by creating a new study space or joining an existing one using an invite code.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button onClick={() => setIsCreateModalOpen(true)}>Create Space</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => {
              const spaceColor = space.color || '#6366f1';
              const IconComp = ICON_MAP[space.icon] || Book;

              return (
                <Card key={space._id || space.id} className="hover:shadow-lg transition-all group flex flex-col h-full overflow-hidden border-0 shadow-md">
                  {/* Colored header band with icon */}
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{ backgroundColor: spaceColor }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <IconComp size={22} className="text-white" />
                      </div>
                      <CardTitle className="text-lg text-white line-clamp-1 drop-shadow-sm" title={space.name}>
                        {space.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 text-white/90">
                      <SpaceMenu
                        space={space}
                        onEdit={() => setEditingSpace(space)}
                        onDelete={() => setDeletingSpace(space)}
                      />
                    </div>
                  </div>

                  <CardHeader className="pb-2 pt-3">
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {space.description || 'No description provided.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="mt-auto pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          <Users size={12} /> {space.membersCount}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(space.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Link to={`/spaces/${space._id || space.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1 group-hover:text-blue-600 group-hover:bg-blue-50">
                          Enter <ArrowRight size={16} />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
    </div>
  );
}
