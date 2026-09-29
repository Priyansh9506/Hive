import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Loader2, TriangleAlert, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

// Declared outside the page so it is not a new component type on every render
// (which would remount the card's contents each time state changes)
const Shell = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <Link to="/" className="flex items-center justify-center gap-2 mb-6">
        <div className="bg-primary/10 p-2 rounded-lg">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <span className="text-xl font-bold text-gray-900">StudySync</span>
      </Link>
      <Card>
        <CardContent className="p-6">{children}</CardContent>
      </Card>
    </div>
  </div>
);

/**
 * Landing screen for an invite link (PRD §10.1): open StudySync, show the space
 * name, sign in if needed, validate the invite, join, then go to the workspace.
 */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/spaces/invite/${code}`);
      setInvite(res.data.invite);
    } catch (err) {
      setError(err.response?.data?.message || 'This invite link is not valid');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    // The preview endpoint is authenticated, so wait until we know who this is.
    // Unauthenticated visitors get the sign-in prompt instead.
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadInvite();
  }, [authLoading, isAuthenticated, loadInvite]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await api.post('/spaces/join', { code });
      toast.success(res.data.message);
      navigate(`/spaces/${res.data.space._id}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not join this space');
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Checking your invitation...</p>
        </div>
      </Shell>
    );
  }

  // Sign in first, then come straight back to this invite
  if (!isAuthenticated) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <h1 className="text-lg font-bold text-gray-900">You have been invited to a study space</h1>
          <p className="text-sm text-gray-500">
            Sign in or create an account to see the invitation and join.
          </p>
          <code className="inline-block text-lg font-bold tracking-[0.2em] bg-gray-50 border rounded-lg px-4 py-2 text-gray-700">
            {code}
          </code>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={() => navigate('/login', { state: { from: `/join/${code}` } })}>
              Sign in
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/signup', { state: { from: `/join/${code}` } })}>
              Create account
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !invite) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="mx-auto h-11 w-11 rounded-full bg-rose-50 flex items-center justify-center">
            <TriangleAlert className="h-5 w-5 text-rose-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">This invitation is not valid</h1>
          <p className="text-sm text-gray-500">{error || 'The invite link could not be found.'}</p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center space-y-5">
        <div
          className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${invite.color}1a` }}
        >
          <BookOpen className="h-7 w-7" style={{ color: invite.color }} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">You are invited to join</p>
          <h1 className="text-xl font-bold text-gray-900">{invite.name}</h1>
          {invite.description && <p className="text-sm text-gray-500">{invite.description}</p>}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={12} /> {invite.membersCount} {invite.membersCount === 1 ? 'member' : 'members'}
          </span>
          <span>·</span>
          <span>Created by {invite.ownerName}</span>
        </div>

        {invite.alreadyMember ? (
          <Button className="w-full" onClick={() => navigate(`/spaces/${invite.spaceId}`)}>
            You are already a member — open it <ArrowRight size={15} className="ml-1.5" />
          </Button>
        ) : invite.valid ? (
          <Button className="w-full" onClick={handleJoin} disabled={joining}>
            {joining ? <Loader2 size={15} className="animate-spin mr-1.5" /> : null}
            {joining ? 'Joining...' : 'Join study space'}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 leading-relaxed">
              {invite.reason}. Ask {invite.ownerName} for a new invite link.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
