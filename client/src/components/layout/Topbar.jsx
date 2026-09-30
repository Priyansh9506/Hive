import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Search, User as UserIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationsBell from './NotificationsBell';
import { usePopIn } from '../../hooks/usePopIn';
import { LogoMark } from '../landing/primitives';
import ThemeToggle from './ThemeToggle';
import { useThemeChoice } from './AppShell';

export default function Topbar({ className = '' }) {
  const themeChoice = useThemeChoice();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const dropdownRef = useRef(null);
  usePopIn(dropdownRef, dropdownOpen);

  // Keep the box in step with the search page's query, so it reads as the
  // same search rather than a blank field
  const currentQuery = location.pathname === '/search' ? new URLSearchParams(location.search).get('q') || '' : '';
  const [query, setQuery] = useState(currentQuery);
  useEffect(() => setQuery(currentQuery), [currentQuery]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className={`bg-paper/80 backdrop-blur-md border-b border-line sticky top-0 z-40 ${className}`}>
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-2 sm:gap-3">
          <div className="flex items-center shrink-0">
            <Link to="/dashboard" className="flex items-center gap-2">
              <LogoMark className="size-7" />
              <span className="hidden sm:inline text-[17px] font-semibold tracking-tight text-ink">StudySync</span>
            </Link>
          </div>

          {/* Search across every space the user belongs to (PRD §23) */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <label className="relative block">
              <span className="sr-only">Search your study spaces</span>
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none`} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages, resources, pins..."
                className="w-full h-9 pl-9 pr-3 text-sm rounded-full bg-sunk border border-line text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-flame/30 focus:border-flame/60 focus:bg-surface transition-colors"
              />
            </label>
          </form>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {themeChoice && (
              <div className="hidden sm:block">
                <ThemeToggle theme={themeChoice.theme} onChange={themeChoice.setTheme} />
              </div>
            )}
            <NotificationsBell />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-sunk p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer"
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
              >
                {user?.avatarUrl ? (
                  <img
                    // Uploaded avatars live on the API server; Google and default
                    // avatars are already full URLs
                    src={
                      user.avatarUrl.startsWith('/uploads/')
                        ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + user.avatarUrl
                        : user.avatarUrl
                    }
                    referrerPolicy="no-referrer"
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover shadow-sm border border-line"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-flame-wash text-flame flex items-center justify-center font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="hidden lg:block text-sm font-medium text-ink">
                  {user?.name}
                </span>
              </button>
  
              {dropdownOpen && (
                <div ref={dropdownRef} className="absolute right-0 top-12 mt-2 w-56 py-1 bg-surface rounded-xl border border-line ls-lift">
                  <div className="px-4 py-2 border-b border-line">
                    <p className={`text-sm font-medium text-ink truncate`}>{user?.name}</p>
                    <p className={`text-xs text-ink-faint truncate`}>{user?.email}</p>
                  </div>
                  {/* On phones the theme switch lives here, out of the crowded bar */}
                  {themeChoice && (
                    <div className="sm:hidden px-4 py-2 border-b border-line flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-soft">Theme</span>
                      <ThemeToggle theme={themeChoice.theme} onChange={themeChoice.setTheme} />
                    </div>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-ink-soft hover:bg-sunk hover:text-ink flex items-center gap-2 cursor-pointer"
                    onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                  >
                    <UserIcon size={16} /> Profile
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
