import React, { useState, useEffect } from 'react';
import Topbar from '../components/layout/Topbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Users, ArrowRight } from 'lucide-react';
import { CreateSpaceModal } from '../components/space/CreateSpaceModal';
import { JoinSpaceModal } from '../components/space/JoinSpaceModal';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function DashboardPage() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

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
            {spaces.map((space) => (
              <Card key={space._id || space.id} className="hover:shadow-md transition-shadow group flex flex-col h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl line-clamp-1" title={space.name}>{space.name}</CardTitle>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
                      <Users size={12} /> {space.membersCount}
                    </span>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {space.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      Created {new Date(space.createdAt).toLocaleDateString()}
                    </span>
                    <Link to={`/spaces/${space._id || space.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 group-hover:text-primary group-hover:bg-primary/5">
                        Enter <ArrowRight size={16} />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
