import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

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
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (isAuthenticated && token) {
      const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      const newSocket = io(backendUrl, {
        auth: { token },
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
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      // Disconnect if logged out
      setSocket(null);
    }
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socket}>
      <SocketStatusContext.Provider value={status}>
        {children}
      </SocketStatusContext.Provider>
    </SocketContext.Provider>
  );
}
