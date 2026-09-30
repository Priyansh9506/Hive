import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { User, Mail, Calendar, Lock, Save, ArrowLeft, Shield, BookOpen, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { setAccessToken } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { Modal } from '../components/ui/Modal';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Cropper state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const fullAvatarUrl = (url) => (url?.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [spacesCount, setSpacesCount] = useState(null);

  // Load spaces count
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get('/spaces');
        setSpacesCount(res.data.count);
      } catch {
        // ignore
      }
    };
    loadStats();
  }, []);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user?.name) return;

    setSavingName(true);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      toast.success('Name updated successfully');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result?.toString() || '');
      setCropModalOpen(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    });
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const onCropComplete = React.useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const uploadCroppedImage = async () => {
    try {
      setUploadingAvatar(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      
      const formData = new FormData();
      formData.append('avatar', croppedImageBlob, 'avatar.jpg');

      await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Profile image updated');
      setCropModalOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.patch('/auth/password', {
        currentPassword,
        newPassword,
      });
      // Other sessions were signed out; this one continues with a new token
      if (res.data.token) {
        setAccessToken(res.data.token);
      }
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <AppShell className="min-h-[100dvh]">
      {/* Header */}
      <header className="bg-paper/80 backdrop-blur-md border-b border-line sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/dashboard"
                className="text-gray-500 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-lg font-semibold tracking-tight text-gray-900 truncate">Profile settings</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Profile Overview Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 sm:gap-5">
              <div className="relative group shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={fullAvatarUrl(user.avatarUrl)}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover shadow-lg border border-gray-200"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-flame-ink text-2xl font-bold shadow-lg">
                    {initials}
                  </div>
                )}
                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera size={20} />
                  <span className="text-[10px] mt-1 font-medium">Edit</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>
                {/* Touch screens cannot hover to reveal "Edit": show a badge */}
                <span className="[@media(hover:hover)]:hidden pointer-events-none absolute -bottom-0.5 -right-0.5 size-7 rounded-full bg-flame text-flame-ink grid place-items-center ring-2 ring-surface">
                  <Camera size={14} />
                </span>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <h2 className="text-xl font-bold text-gray-900 truncate">{user?.name}</h2>
                <p className="text-sm text-gray-500 truncate flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <Mail size={14} /> {user?.email}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Joined {joinedDate}
                  </span>
                  {spacesCount !== null && (
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} /> {spacesCount} study space{spacesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Name */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User size={18} /> Personal Information
            </CardTitle>
            <CardDescription>Update your display name</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">Email cannot be changed</p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={savingName || !name.trim() || name.trim() === user?.name}
                  className="flex items-center gap-2"
                >
                  <Save size={16} />
                  {savingName ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock size={18} /> Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex items-center gap-2"
                >
                  <Shield size={16} />
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-600">Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Sign out of your account</p>
                <p className="text-xs text-gray-400">You will need to log in again</p>
              </div>
              <Button variant="destructive" onClick={logout} className="flex items-center gap-2">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crop Modal */}
      <Modal isOpen={cropModalOpen} onClose={() => !uploadingAvatar && setCropModalOpen(false)} title="Crop Profile Picture">
        <div className="relative w-full h-64 bg-[#18181b] rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 mt-2 border-t">
            <Button variant="ghost" onClick={() => setCropModalOpen(false)} disabled={uploadingAvatar}>
              Cancel
            </Button>
            <Button onClick={uploadCroppedImage} disabled={uploadingAvatar}>
              {uploadingAvatar ? 'Uploading...' : 'Save Image'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
