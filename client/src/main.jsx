import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'
import { GOOGLE_CLIENT_ID } from './lib/google'
import { startPwaUpdates } from './lib/pwaUpdates'

// Installed app: stay on the latest deploy (see lib/pwaUpdates.js)
startPwaUpdates()

// Google sign-in is optional: without a client id the provider (and its
// script) is skipped and the Google buttons do not render
const app = GOOGLE_CLIENT_ID ? (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {app}
  </React.StrictMode>,
)
