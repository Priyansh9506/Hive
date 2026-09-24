const WebSocket = require('ws');
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;

const initYjs = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', setupWSConnection);

  server.on('upgrade', (request, socket, head) => {
    // Only handle WebSocket upgrade if the path is /yjs
    if (request.url.startsWith('/yjs')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  console.log('Yjs WebSocket server initialized on /yjs');
};

module.exports = { initYjs };
