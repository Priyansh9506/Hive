import React, { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Code2, FileUp, Link2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const MAX_MB = 10;

const TABS = [
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'file', label: 'File', icon: FileUp },
  { id: 'code', label: 'Code', icon: Code2 },
];

export default function AddResourceModal({ isOpen, onClose, spaceId, onAdded }) {
  const [tab, setTab] = useState('link');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setTitle(''); setDescription(''); setUrl(''); setCode('');
    setLanguage('plaintext'); setFile(null); setTab('link');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    // Checked here as well as on the server so the user is not made to wait for
    // a 10 MB upload only to be told it was too big.
    if (picked.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is ${(picked.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB`);
      e.target.value = '';
      return;
    }

    setFile(picked);
    // Offer the filename as the title so a quick upload needs no typing
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Please give this resource a title');

    setSaving(true);
    try {
      let res;

      if (tab === 'file') {
        if (!file) {
          setSaving(false);
          return toast.error('Please choose a file to upload');
        }
        const form = new FormData();
        form.append('title', title.trim());
        form.append('description', description.trim());
        form.append('file', file);
        // Let the browser set the multipart boundary
        res = await api.post(`/spaces/${spaceId}/resources`, form, {
          headers: { 'Content-Type': undefined },
        });
      } else if (tab === 'code') {
        if (!code.trim()) {
          setSaving(false);
          return toast.error('Please paste the code snippet');
        }
        res = await api.post(`/spaces/${spaceId}/resources`, {
          title: title.trim(), description: description.trim(), type: 'code', code, language,
        });
      } else {
        if (!url.trim()) {
          setSaving(false);
          return toast.error('Please provide a URL');
        }
        res = await api.post(`/spaces/${spaceId}/resources`, {
          title: title.trim(), description: description.trim(), url: url.trim(),
        });
      }

      onAdded?.(res.data.resource);
      toast.success('Resource added');
      reset();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add a resource">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type picker */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              disabled={saving}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="resourceTitle">Title</Label>
          <Input
            id="resourceTitle"
            placeholder="e.g., Normalization worked examples"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            maxLength={150}
            required
          />
        </div>

        {tab === 'link' && (
          <div className="space-y-2">
            <Label htmlFor="resourceUrl">URL</Label>
            <Input
              id="resourceUrl"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
            />
          </div>
        )}

        {tab === 'file' && (
          <div className="space-y-2">
            <Label>File</Label>
            {file ? (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 border rounded-lg">
                <FileUp size={15} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-gray-400 hover:text-rose-600 p-0.5"
                  disabled={saving}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-6 text-center hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
              >
                <FileUp size={20} className="mx-auto text-gray-400 mb-1.5" />
                <p className="text-sm text-gray-600 font-medium">Choose a file</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Images, PDFs, or documents · up to {MAX_MB} MB
                </p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            />
          </div>
        )}

        {tab === 'code' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="resourceLanguage">Language</Label>
              <select
                id="resourceLanguage"
                className="w-full h-10 text-sm rounded-md border border-input bg-transparent px-3"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={saving}
              >
                {['plaintext', 'sql', 'javascript', 'python', 'java', 'c', 'cpp', 'html', 'css', 'bash'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resourceCode">Code</Label>
              <textarea
                id="resourceCode"
                rows={7}
                placeholder="Paste the snippet..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={saving}
                maxLength={20000}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="resourceDescription">Explanation (optional)</Label>
          <textarea
            id="resourceDescription"
            rows={2}
            placeholder="Why is this useful? e.g. 'Use normalization here...'"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            maxLength={1000}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {saving ? 'Adding...' : 'Add resource'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
