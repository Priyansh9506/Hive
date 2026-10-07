import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { LogoMark } from '../components/landing/primitives';
import { useAuth } from '../context/AuthContext';

/** Any address the app has no page for (a mistyped link, an old bookmark) */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <AppShell className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
      <Link to="/" className="flex items-center gap-2 mb-10">
        <LogoMark className="size-8" />
        <span className="text-xl font-semibold tracking-tight text-ink">Hive</span>
      </Link>
      <p className="font-geist-mono text-sm text-flame">404</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tight text-ink">This page wandered off</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        There is nothing at <code className="font-geist-mono text-ink break-all">{pathname}</code>. Check the link,
        or head back to your study spaces.
      </p>
      <Link
        to={isAuthenticated ? '/dashboard' : '/'}
        className="mt-8 inline-flex items-center h-11 px-6 rounded-full bg-flame text-flame-ink text-sm font-medium hover:opacity-90"
      >
        {isAuthenticated ? 'Go to dashboard' : 'Go to home page'}
      </Link>
    </AppShell>
  );
}
