import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import api from '../../lib/api';

export function DeleteSpaceModal({ isOpen, onClose, space, onDelete }) {
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const spaceName = space?.name || '';

  const handleDelete = async () => {
    if (confirmation !== spaceName) return;

    setLoading(true);
    try {
      const spaceId = space._id || space.id;
      await api.delete(`/spaces/${spaceId}`);
      onDelete(spaceId);
      toast.success('Space deleted permanently');
      onClose();
      setConfirmation('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete space');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Study Space">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-red-700">
            <p className="font-semibold">This action is irreversible!</p>
            <p className="mt-1">
              Deleting <strong>{spaceName}</strong> will permanently remove all messages,
              notes, memberships, and data associated with this space.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deleteConfirm">
            Type <strong className="text-red-600">{spaceName}</strong> to confirm
          </Label>
          <Input
            id="deleteConfirm"
            placeholder="Type the space name..."
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={confirmation !== spaceName || loading}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
