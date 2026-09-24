import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import toast from 'react-hot-toast';

import api from '../../lib/api';

export function CreateSpaceModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post('/spaces', { name, description });
      onCreate(response.data.space);
      toast.success('Study space created!');
      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Study Space">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="spaceName">Space Name</Label>
          <Input
            id="spaceName"
            placeholder="e.g., CS101 Study Group"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spaceDescription">Description (Optional)</Label>
          <Input
            id="spaceDescription"
            placeholder="What is this space for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Space'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
