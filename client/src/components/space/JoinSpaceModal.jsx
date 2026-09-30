import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import toast from 'react-hot-toast';

import api from '../../lib/api';

// Accept a pasted invite link as well as the bare code
const codeFrom = (input) => {
  const text = String(input).trim();
  const fromLink = text.match(/\/join\/([^/?#\s]+)/i);
  return fromLink ? decodeURIComponent(fromLink[1]) : text;
};

export function JoinSpaceModal({ isOpen, onClose, onJoin }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post('/spaces/join', { code: codeFrom(code) });
      onJoin(response.data.space);
      toast.success('Successfully joined the study space!');
      onClose();
      setCode('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid invite code or failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Study Space">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="inviteCode">Invite Code</Label>
          <Input
            id="inviteCode"
            placeholder="e.g. 7KQ-9PM"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            required
            disabled={loading}
          />
          <p className="text-sm text-gray-500">Paste the invite link, or type the code the owner shared.</p>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Joining...' : 'Join Space'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
