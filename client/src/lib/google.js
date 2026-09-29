// OAuth 2.0 Client ID from Google Cloud Console. The same value goes in the
// server's GOOGLE_CLIENT_ID, which checks that tokens were issued for it.
// Empty means Google sign-in is off and its buttons do not render.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
