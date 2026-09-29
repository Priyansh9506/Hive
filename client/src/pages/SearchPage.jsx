import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Highlighter, Loader2, MessageSquare, Paperclip, Pin, Search } from 'lucide-react';
import Topbar from '../components/layout/Topbar';
import api from '../lib/api';

// Wrap each occurrence of the query in <mark>, so a result shows why it matched
function Marked({ text, query }) {
  if (!text) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-100 text-inherit rounded px-0.5">{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

// Each group links into its space at the panel the result lives in
const GROUPS = [
  {
    key: 'spaces',
    label: 'Study spaces',
    singular: 'study space',
    icon: BookOpen,
    link: (r) => `/spaces/${r._id}`,
    title: (r) => r.name,
    body: (r) => r.description,
  },
  {
    key: 'messages',
    label: 'Messages',
    singular: 'message',
    icon: MessageSquare,
    link: (r) => `/spaces/${r.spaceId}?message=${r._id}`,
    title: (r) => r.content,
    meta: (r) => `${r.senderName} in ${r.spaceName}`,
  },
  {
    key: 'resources',
    label: 'Resources',
    singular: 'resource',
    icon: Paperclip,
    link: (r) => `/spaces/${r.spaceId}?tab=resources`,
    title: (r) => r.title,
    body: (r) => r.description,
    meta: (r) => `${r.uploadedByName} in ${r.spaceName}`,
  },
  {
    key: 'pins',
    label: 'Pinned items',
    singular: 'pinned item',
    icon: Pin,
    link: (r) => `/spaces/${r.spaceId}?tab=pins`,
    title: (r) => r.label,
    meta: (r) => `pinned by ${r.pinnedByName} in ${r.spaceName}`,
  },
  {
    key: 'highlights',
    label: 'Highlights',
    singular: 'highlight',
    icon: Highlighter,
    link: (r) => `/spaces/${r.spaceId}?tab=highlights`,
    title: (r) => r.label,
    meta: (r) => `${r.createdByName} in ${r.spaceName}`,
  },
];

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setError(query ? 'Please enter at least 2 characters to search' : '');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/search', { params: { q: query, limit: 15 } });
        if (cancelled) return;
        setResults(res.data.results);
        setTotal(res.data.total);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Topbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={22} className="text-gray-400" />
          {query ? <>Results for “{query}”</> : 'Search'}
        </h1>

        {!loading && results && (
          // The PRD's example summary: "12 messages · 3 resources · 2 pinned items"
          <p className="text-sm text-gray-500 mt-1">
            {total === 0
              ? 'Nothing matched in your study spaces.'
              : GROUPS.filter((g) => results[g.key].length)
                  .map((g) => { const n = results[g.key].length; return `${n} ${n === 1 ? g.singular : g.label.toLowerCase()}`; })
                  .join(' · ')}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Searching...
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-rose-600">{error}</p>
        ) : !results ? (
          <p className="mt-6 text-sm text-gray-500">
            Use the search box above to look through messages, resources, pins and highlights in all your spaces.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {GROUPS.filter((g) => results[g.key].length > 0).map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.key}>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                    <Icon size={13} /> {group.label}
                  </h2>
                  <ul className="bg-white border border-gray-200 rounded-lg divide-y">
                    {results[group.key].map((r) => (
                      <li key={r._id}>
                        <Link to={group.link(r)} className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            <Marked text={group.title(r)} query={query} />
                          </p>
                          {group.body?.(r) && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              <Marked text={group.body(r)} query={query} />
                            </p>
                          )}
                          {group.meta && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              {group.meta(r)}
                              {r.createdAt && ` · ${new Date(r.createdAt).toLocaleDateString()}`}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
