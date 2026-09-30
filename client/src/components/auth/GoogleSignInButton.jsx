import React, { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { GOOGLE_CLIENT_ID } from '../../lib/google';

// Google renders its button in an iframe at a fixed pixel width (200-400)
// (snapped to 10px so a window resize does not re-render it on every pixel)
const clampWidth = (w) => Math.min(400, Math.max(200, Math.floor(w / 10) * 10));

const LABELS = {
  signin_with: 'Sign in with Google',
  signup_with: 'Sign up with Google',
  continue_with: 'Continue with Google',
};

// Google's multi-colour "G", as its branding guidelines require
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Sign in with Google" followed by an "or" divider, for the login and signup
 * pages. Google returns a signed ID token; the server verifies it and answers
 * with the app's own session, exactly like a password login. Renders nothing
 * when Google sign-in is not configured.
 *
 * Google's own button is a cross-origin iframe that cannot be styled (and on a
 * dark page it gets painted on a white box). So the page draws its own pill in
 * the app's style and lays Google's real button over it, invisible: every
 * click still lands on Google's button, which is what issues the ID token.
 *
 * @param {object} props
 * @param {string} props.redirectTo - where to go once signed in
 * @param {'signin_with' | 'signup_with' | 'continue_with'} [props.text]
 */
export default function GoogleSignInButton({ redirectTo, text = 'continue_with' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const slotRef = useRef(null);
  const [width, setWidth] = useState(360);
  const [busy, setBusy] = useState(false);

  // Size Google's (invisible) button to cover ours exactly
  useLayoutEffect(() => {
    if (!slotRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(clampWidth(entry.contentRect.width)));
    observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async ({ credential }) => {
    setBusy(true);
    try {
      const user = await loginWithGoogle(credential);
      toast.success(`Welcome, ${user.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div data-auth-item className="grid gap-6">
      <div ref={slotRef} className="group relative h-11 w-full">
        {/* What people see */}
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center gap-3 rounded-full border border-line bg-surface text-[15px] font-medium text-ink transition-colors group-hover:bg-sunk group-focus-within:ring-2 group-focus-within:ring-flame/40"
        >
          {busy ? (
            <span className="size-[18px] animate-spin rounded-full border-2 border-line border-t-flame" />
          ) : (
            <GoogleG />
          )}
          {busy ? 'Signing you in…' : LABELS[text] || LABELS.continue_with}
        </div>

        {/* What gets clicked: Google's real button, stretched over ours.
            color-scheme stops the browser giving the iframe a white canvas
            while it loads, and opacity keeps it invisible. */}
        <div
          className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full opacity-[0.01] ${
            busy ? 'pointer-events-none' : ''
          }`}
          style={{ colorScheme: 'light' }}
        >
          <GoogleLogin
            key={width}
            onSuccess={handleSuccess}
            onError={() => toast.error('Google sign-in was cancelled or failed')}
            text={text}
            shape="pill"
            size="large"
            width={String(width)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
