const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient, subClient } = require('./redis');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Setup Redis adapter if Redis is enabled
  if (redisClient && subClient) {
    io.adapter(createAdapter(redisClient, subClient));
    console.log('Socket.IO: Redis adapter connected');
  } else {
    console.log('Socket.IO: Using in-memory adapter (Redis disabled)');
  }

  // Socket.IO Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Attach user info to the socket
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Handle Connections
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id} (Socket: ${socket.id})`);

    // Join a specific study space room
    socket.on('join_space', (spaceId) => {
      socket.join(`space:${spaceId}`);
      console.log(`User ${socket.user.id} joined space:${spaceId}`);
      
      // Broadcast presence (optional, if building member list)
      socket.to(`space:${spaceId}`).emit('user_joined', { userId: socket.user.id });
    });

    // Leave a specific study space room
    socket.on('leave_space', (spaceId) => {
      socket.leave(`space:${spaceId}`);
      console.log(`User ${socket.user.id} left space:${spaceId}`);
      socket.to(`space:${spaceId}`).emit('user_left', { userId: socket.user.id });
    });

    // Handle Chat Messages
    socket.on('send_message', (data) => {
      // Broadcast to everyone in the room EXCEPT the sender
      socket.to(`space:${data.spaceId}`).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIo,
};
