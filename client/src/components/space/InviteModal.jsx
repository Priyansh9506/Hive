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

const EXPIRY_PRESETS = [
  { value: null, label: 'Never' },
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];
const USE_PRESETS = [
  { value: null, label: 'Unlimited' },
  { value: 1, label: '1' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
];
// Same bounds the server enforces (inviteController.updateInvite)
const MAX_DAYS = 365;
const MAX_USES = 1000;

const CHIP = 'h-8 px-3 rounded-full text-[13px] font-medium border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const chipClass = (active) =>
  `${CHIP} ${active ? 'bg-ink text-paper border-ink' : 'bg-surface text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'}`;

const whenLabel = (iso) => {
  const date = new Date(iso);
  const days = Math.ceil((date - Date.now()) / 86400000);
  const on = date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Expired ${on}`;
  return `Expires ${on} · in ${days} ${days === 1 ? 'day' : 'days'}`;
};

/**
 * A row of preset chips plus "Custom", which opens a number field for any
 * other value. `current` is the saved value (null = no limit).
 */
function LimitPicker({ id, label, presets, current, customFor, customLabel, unit, min, max, onSave, saving, hint }) {
  const isPreset = presets.some((p) => p.value === current);
  const [customOpen, setCustomOpen] = useState(false);
  const savedCustom = !isPreset && current !== null && customFor === 'value' ? String(current) : '';
  // What the field shows: the saved custom value, or the draft while editing
  const [draft, setDraft] = useState('');
  const fieldValue = customOpen ? draft : savedCustom;

  const showCustom = customOpen || savedCustom !== '';
  const n = Number(fieldValue);
  const valid = fieldValue !== '' && Number.isInteger(n) && n >= min && n <= max;

  const openCustom = () => {
    setDraft(savedCustom);
    setCustomOpen(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    if (await onSave(n)) setCustomOpen(false);
  };

  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-medium text-gray-700">{label}</p>
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={saving}
            aria-pressed={!showCustom && current === p.value}
            onClick={() => { setCustomOpen(false); onSave(p.value); }}
            className={chipClass(!showCustom && current === p.value)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          disabled={saving}
          aria-pressed={showCustom || Boolean(customLabel)}
          onClick={openCustom}
          className={chipClass(showCustom || Boolean(customLabel))}
        >
          {customLabel && !customOpen ? customLabel : 'Custom'}
        </button>
      </div>

      {showCustom && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              autoFocus={customOpen}
              placeholder={`${min}–${max}`}
              value={fieldValue}
              onChange={(e) => {
                setDraft(e.target.value);
                setCustomOpen(true);
              }}
              // No spinner arrows: they would sit on top of the unit label
              className="pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-describedby={`${id}-hint`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              {unit(n)}
            </span>
          </div>
          {/* Nothing to save until the number is edited */}
          <Button type="submit" size="sm" disabled={!valid || saving || !customOpen || fieldValue === savedCustom}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : 'Set'}
          </Button>
        </form>
      )}
      {showCustom && fieldValue !== '' && !valid && (
        <p id={`${id}-hint`} className="text-xs text-rose-600">Enter a whole number from {min} to {max}.</p>
      )}
      {hint && <div className="text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

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

  const [savingLimit, setSavingLimit] = useState('');
  // Resolves true when saved, so a custom field knows to close
  const handleLimits = async (field, value) => {
    setSavingLimit(field);
    try {
      const res = await api.post(`/spaces/${spaceId}/invites`, { [field]: value });
      setInvite(res.data.invite);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invite settings');
      return false;
    } finally {
      setSavingLimit('');
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
        <div className="space-y-6">
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
            <div className="space-y-5 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Invite settings</p>

              {/* A real switch, not a bare checkbox */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p id="allowJoin" className="text-sm font-medium text-gray-700">Allow people to join</p>
                  <p className="text-xs text-gray-500">Turn off to pause the link and code without changing them.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={invite.inviteEnabled}
                  aria-labelledby="allowJoin"
                  onClick={handleToggleInvites}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame ${
                    invite.inviteEnabled ? 'bg-flame' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                      invite.inviteEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <LimitPicker
                id="inviteExpiry"
                label="Expires in"
                presets={EXPIRY_PRESETS}
                // The server stores a date, not the choice that produced it
                current={invite.expiresAt ? 'date' : null}
                customFor="date"
                // A set expiry is shown as its date on the Custom chip
                customLabel={
                  invite.expiresAt
                    ? `Until ${new Date(invite.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                    : null
                }
                unit={(n) => (n === 1 ? 'day' : 'days')}
                min={1}
                max={MAX_DAYS}
                saving={savingLimit === 'expiresInDays'}
                onSave={(days) => handleLimits('expiresInDays', days)}
                hint={
                  invite.expiresAt ? (
                    <span className={invite.expired ? 'text-rose-600' : ''}>{whenLabel(invite.expiresAt)}</span>
                  ) : (
                    'The link works until you turn it off or generate a new one.'
                  )
                }
              />

              <LimitPicker
                id="inviteMaxUses"
                label="Max people who can join"
                presets={USE_PRESETS}
                current={invite.maxUses}
                customFor="value"
                unit={(n) => (n === 1 ? 'person' : 'people')}
                min={1}
                max={MAX_USES}
                saving={savingLimit === 'maxUses'}
                onSave={(uses) => handleLimits('maxUses', uses)}
                hint={
                  invite.maxUses === null ? (
                    `Joined with this code so far: ${invite.uses}. Anyone with the link can join.`
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${invite.exhausted ? 'bg-rose-500' : 'bg-flame'}`}
                          style={{ width: `${Math.min(100, (invite.uses / invite.maxUses) * 100)}%` }}
                        />
                      </div>
                      <p className={invite.exhausted ? 'text-rose-600' : ''}>
                        {invite.uses} of {invite.maxUses} {invite.maxUses === 1 ? 'place' : 'places'} used
                        {invite.exhausted ? ' · the code is full' : ` · ${invite.maxUses - invite.uses} left`}
                      </p>
                    </div>
                  )
                }
              />

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
