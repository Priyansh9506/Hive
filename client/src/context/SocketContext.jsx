import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getAccessToken, refreshSession } from '../lib/api';

const SocketContext = createContext();
// Kept separate from the socket itself so that a status flip re-renders only
// the components showing it, not every component using the socket.
const SocketStatusContext = createContext('connecting');

export function useSocket() {
  return useContext(SocketContext);
}

// 'connecting' | 'connected' | 'reconnecting'
export function useSocketStatus() {
  return useContext(SocketStatusContext);
}

export function SocketProvider({ children }) {
  // Signed in with an access token: a session restored offline from cache has
  // none yet, and connects once AuthContext renews it
  const { sessionReady } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (sessionReady && getAccessToken()) {
      const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      const newSocket = io(backendUrl, {
        // Read on every (re)connect, so a reconnect uses the current access
        // token rather than the one from when the page loaded
        auth: (cb) => cb({ token: getAccessToken() }),
        transports: ['websocket'],
      });

      setStatus('connecting');

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setStatus('connected');
      });

      newSocket.on('disconnect', () => setStatus('reconnecting'));

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setStatus('reconnecting');
        // The server refused the handshake, typically an access token that ran
        // out while the laptop slept. Socket.IO does not retry these by itself.
        if (err.message.startsWith('Authentication error')) {
          refreshSession()
            .then(() => newSocket.connect())
            .catch(() => {});
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      // Disconnect if logged out
      setSocket(null);
    }
  }, [sessionReady]);

  return (
    <SocketContext.Provider value={socket}>
      <SocketStatusContext.Provider value={status}>
        {children}
      </SocketStatusContext.Provider>
    </SocketContext.Provider>
  );
}
