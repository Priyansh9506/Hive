import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Check, Copy, Link2, Loader2, Mail, RefreshCw, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// navigator.clipboard needs a secure context, which a LAN dev origin
// (http://192.168.x.x) is not — fall back to a temporary textarea.
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
};

export default function InviteModal({ isOpen, onClose, spaceId, spaceName, userRole }) {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isOwner = userRole === 'owner';

  const loadInvite = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/spaces/${spaceId}/invites`);
      setInvite(res.data.invite);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load invite details');
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (isOpen) loadInvite();
  }, [isOpen, loadInvite]);

  const handleCopy = async (value, which) => {
    if (await copyText(value)) {
      setCopied(which);
      setTimeout(() => setCopied(''), 1800);
    } else {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/invites/regenerate`);
      setInvite(res.data.invite);
      toast.success('New code generated. The old link no longer works.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleInvites = async () => {
    try {
      const res = await api.post(`/spaces/${spaceId}/invites`, {
        inviteEnabled: !invite.inviteEnabled,
      });
      setInvite(res.data.invite);
      toast.success(res.data.invite.inviteEnabled ? 'Invites enabled' : 'Invites disabled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invite settings');
    }
  };

  const handleLimits = async (field, value) => {
    try {
      const res = await api.post(`/spaces/${spaceId}/invites`, { [field]: value });
      setInvite(res.data.invite);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invite settings');
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emails.trim()) return;

    setSending(true);
    try {
      const res = await api.post(`/spaces/${spaceId}/invites/email`, {
        emails: emails.split(',').map((s) => s.trim()).filter(Boolean),
        message,
      });
      toast.success(res.data.message);
      setEmails('');
      setMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invite people to ${spaceName}`}>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading invite details...
        </div>
      ) : !invite ? (
        <p className="text-sm text-gray-500 py-6 text-center">Could not load invite details.</p>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Anything blocking joins is stated up front, not discovered on failure */}
          {(!invite.inviteEnabled || invite.expired || invite.exhausted) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <TriangleAlert size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {!invite.inviteEnabled
                  ? 'Invites are disabled for this space. Nobody can join until you enable them.'
                  : invite.expired
                    ? 'This invite code has expired. Regenerate it or clear the expiry.'
                    : 'This code has reached its maximum number of uses. Regenerate it or raise the limit.'}
              </p>
            </div>
          )}

          {/* ---------- Invite link ---------- */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link2 size={13} /> Invite link
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={invite.inviteUrl} className="text-xs font-mono" onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => handleCopy(invite.inviteUrl, 'link')}>
                {copied === 'link' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          {/* ---------- Join code ---------- */}
          <div className="space-y-2">
            <Label>Join code</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-2xl font-bold tracking-[0.2em] bg-gray-50 border border-gray-200 rounded-lg py-3 text-gray-800 select-all">
                {invite.joinCode}
              </code>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => handleCopy(invite.joinCode, 'code')}>
                {copied === 'code' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">
              Used {invite.uses} {invite.uses === 1 ? 'time' : 'times'}
              {invite.maxUses !== null && ` of ${invite.maxUses} allowed`}
              {invite.expiresAt && ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
            </p>
          </div>

          {/* ---------- Owner controls ---------- */}
          {isOwner && (
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-xs uppercase tracking-wide text-gray-400">Invite settings</Label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Allow people to join</span>
                <input
                  type="checkbox"
                  checked={invite.inviteEnabled}
                  onChange={handleToggleInvites}
                  className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="inviteExpiry" className="text-xs text-gray-500">Expires in</Label>
                  <select
                    id="inviteExpiry"
                    className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-2"
                    value={invite.expiresAt ? 'custom' : 'never'}
                    onChange={(e) => handleLimits('expiresInDays', e.target.value === 'never' ? null : Number(e.target.value))}
                  >
                    <option value="never">Never</option>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    {invite.expiresAt && <option value="custom">{new Date(invite.expiresAt).toLocaleDateString()}</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="inviteMaxUses" className="text-xs text-gray-500">Max uses</Label>
                  <select
                    id="inviteMaxUses"
                    className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-2"
                    value={invite.maxUses === null ? 'unlimited' : String(invite.maxUses)}
                    onChange={(e) => handleLimits('maxUses', e.target.value === 'unlimited' ? null : Number(e.target.value))}
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="1">1 person</option>
                    <option value="5">5 people</option>
                    <option value="10">10 people</option>
                    <option value="25">25 people</option>
                    {invite.maxUses !== null && ![1, 5, 10, 25].includes(invite.maxUses) && (
                      <option value={String(invite.maxUses)}>{invite.maxUses} people</option>
                    )}
                  </select>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RefreshCw size={13} className="mr-1.5" />}
                Generate a new code
              </Button>
            </div>
          )}

          {/* ---------- Email invite ---------- */}
          <form onSubmit={handleSendEmail} className="space-y-3 pt-4 border-t">
            <Label htmlFor="inviteEmails" className="flex items-center gap-1.5">
              <Mail size={13} /> Invite by email
            </Label>

            {!invite.emailEnabled && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-2 leading-relaxed">
                Email is not configured on this server. Registered users still get an in-app
                invite; everyone else needs the link or code above.
              </p>
            )}

            <Input
              id="inviteEmails"
              placeholder="friend@college.edu, other@college.edu"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              disabled={sending}
            />
            <Input
              placeholder="Add a short message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              maxLength={500}
            />
            <Button type="submit" size="sm" className="w-full" disabled={sending || !emails.trim()}>
              {sending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Mail size={13} className="mr-1.5" />}
              {sending ? 'Sending...' : 'Send invitation'}
            </Button>
          </form>
        </div>
      )}
    </Modal>
  );
}
