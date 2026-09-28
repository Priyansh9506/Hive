const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient, subClient } = require('./redis');
const Message = require('../models/Message');
const User = require('../models/User');
const Membership = require('../models/Membership');

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
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = { id: user._id.toString(), name: user.name, email: user.email };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Handle Connections
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

    // Join a specific study space room
    socket.on('join_space', async (spaceId) => {
      // Verify membership before allowing room join
      const membership = await Membership.findOne({ spaceId, userId: socket.user.id });
      if (!membership) {
        socket.emit('error_msg', { message: 'Not a member of this space' });
        return;
      }

      socket.join(`space:${spaceId}`);
      console.log(`${socket.user.name} joined space:${spaceId}`);
      
      // Broadcast presence to other members
      socket.to(`space:${spaceId}`).emit('user_joined', {
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    // Leave a specific study space room
    socket.on('leave_space', (spaceId) => {
      socket.leave(`space:${spaceId}`);
      socket.to(`space:${spaceId}`).emit('user_left', {
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    // Handle Chat Messages — persist to MongoDB + broadcast
    socket.on('send_message', async (data) => {
      try {
        const { spaceId, content, clientId } = data;

        if (!content || !content.trim() || !spaceId) return;

        // Save to database
        const message = await Message.create({
          spaceId,
          senderId: socket.user.id,
          senderName: socket.user.name,
          content: content.trim(),
          clientId, // For optimistic dedup on the client
        });

        const msgPayload = {
          _id: message._id,
          spaceId: message.spaceId,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          clientId: message.clientId,
          createdAt: message.createdAt,
        };

        // Broadcast to ALL members in the room INCLUDING the sender
        // The sender uses clientId to replace their optimistic message
        io.to(`space:${spaceId}`).emit('receive_message', msgPayload);
      } catch (err) {
        console.error('Error saving message:', err.message);
        socket.emit('error_msg', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing_start', (spaceId) => {
      socket.to(`space:${spaceId}`).emit('user_typing', {
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    socket.on('typing_stop', (spaceId) => {
      socket.to(`space:${spaceId}`).emit('user_stop_typing', {
        userId: socket.user.id,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
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
