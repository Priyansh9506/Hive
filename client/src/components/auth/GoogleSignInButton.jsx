import React, { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { GOOGLE_CLIENT_ID } from '../../lib/google';

// Google renders its button in an iframe at a fixed pixel width (200-400)
// (snapped to 10px so a window resize does not re-render it on every pixel)
const clampWidth = (w) => Math.min(400, Math.max(200, Math.floor(w / 10) * 10));

/**
 * "Sign in with Google" followed by an "or" divider, for the login and signup
 * pages. Google returns a signed ID token; the server verifies it and answers
 * with the app's own JWT, exactly like a password login. Renders nothing when
 * Google sign-in is not configured.
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
  const dark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Match the form's width instead of a hard-coded size
  useLayoutEffect(() => {
    if (!slotRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(clampWidth(entry.contentRect.width)));
    observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async ({ credential }) => {
    try {
      const user = await loginWithGoogle(credential);
      toast.success(`Welcome, ${user.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <div data-auth-item className="grid gap-6">
      <div ref={slotRef} className="flex h-11 justify-center">
        <GoogleLogin
          key={`${width}-${dark}`}
          onSuccess={handleSuccess}
          onError={() => toast.error('Google sign-in was cancelled or failed')}
          text={text}
          shape="pill"
          size="large"
          theme={dark ? 'filled_black' : 'outline'}
          width={String(width)}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
