import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { GOOGLE_CLIENT_ID } from '../../lib/google';

/**
 * "Sign in with Google" plus an "or" divider, for the login and signup pages.
 * Google returns a signed ID token; the server verifies it and answers with
 * the app's own JWT, exactly like a password login. Renders nothing when
 * Google sign-in is not configured.
 *
 * @param {object} props
 * @param {string} props.redirectTo - where to go once signed in
 * @param {'signin_with' | 'signup_with' | 'continue_with'} [props.text]
 */
export default function GoogleSignInButton({ redirectTo, text = 'continue_with' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

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
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => toast.error('Google sign-in was cancelled or failed')}
          text={text}
          shape="rectangular"
          width="360"
        />
      </div>
    </div>
  );
}
