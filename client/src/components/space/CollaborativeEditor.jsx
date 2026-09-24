import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import { useAuth } from '../../context/AuthContext';

Quill.register('modules/cursors', QuillCursors);

export default function CollaborativeEditor({ spaceId }) {
  const editorRef = useRef(null);
  const { user } = useAuth();
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!editorRef.current) return;

    // A Yjs document holds the shared data
    const ydoc = new Y.Doc();
    
    // Connect to our own local Yjs WebSocket server
    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('http', 'ws');
    const provider = new WebsocketProvider(
      `${wsUrl}/yjs`,
      `studysync-room-${spaceId}`,
      ydoc
    );

    provider.on('status', event => {
      setStatus(event.status); // 'connected' or 'disconnected'
    });

    // Define a shared text type on the document
    const ytext = ydoc.getText('quill');

    // Setup Quill Editor
    const editor = new Quill(editorRef.current, {
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline'],
          ['image', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
        ],
        history: {
          userOnly: true
        }
      },
      placeholder: 'Start taking notes collaboratively...',
      theme: 'snow'
    });

    // Bind Quill to Yjs
    const binding = new QuillBinding(ytext, editor, provider.awareness);

    // Set User Awareness (Cursor details)
    provider.awareness.setLocalStateField('user', {
      name: user.name,
      color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color for cursors
    });

    return () => {
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
      editor.off('text-change');
    };
  }, [spaceId, user.name]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-700">Shared Notes</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {/* Editor Container */}
        <div ref={editorRef} className="h-full border-none" />
      </div>
    </div>
  );
}
