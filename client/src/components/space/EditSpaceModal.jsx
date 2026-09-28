import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import toast from 'react-hot-toast';
import { ICON_OPTIONS, COLOR_OPTIONS } from './CreateSpaceModal';
import api from '../../lib/api';

export function EditSpaceModal({ isOpen, onClose, space, onUpdate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('book');
  const [color, setColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);

  // Sync form with the space prop when it changes
  useEffect(() => {
    if (space) {
      setName(space.name || '');
      setDescription(space.description || '');
      setIcon(space.icon || 'book');
      setColor(space.color || '#6366f1');
    }
  }, [space]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const spaceId = space._id || space.id;
      const response = await api.patch(`/spaces/${spaceId}`, {
        name,
        description,
        icon,
        color,
      });
      onUpdate(response.data.space);
      toast.success('Space updated!');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update space');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Study Space">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="editSpaceName">Space Name</Label>
          <Input
            id="editSpaceName"
            placeholder="e.g., CS101 Study Group"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="editSpaceDescription">Description</Label>
          <Input
            id="editSpaceDescription"
            placeholder="What is this space for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Icon Picker */}
        <div className="space-y-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map(({ value, icon: IconComponent }) => (
              <button
                key={value}
                type="button"
                onClick={() => setIcon(value)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  icon === value
                    ? 'border-blue-500 bg-blue-50 scale-110'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <IconComponent size={20} className={icon === value ? 'text-blue-600' : 'text-gray-500'} />
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label>Card Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c ? 'border-gray-900 scale-125 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
