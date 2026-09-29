const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient, subClient } = require('./redis');
const Message = require('../models/Message');
const User = require('../models/User');
const Membership = require('../models/Membership');

let io;

// Distinct users currently connected to a space room. Uses the adapter's socket
// registry rather than a local Map so it stays correct across multiple server
// instances when the Redis adapter is active.
const presenceFor = async (spaceId) => {
  const sockets = await io.in(`space:${spaceId}`).fetchSockets();
  const byUser = new Map();
  for (const s of sockets) {
    if (s.user) byUser.set(s.user.id, { userId: s.user.id, name: s.user.name });
  }
  return [...byUser.values()];
};

// True when the user has no remaining sockets in the room (other tabs count),
// i.e. they have actually gone offline for this space rather than closed one tab.
const hasLeftRoom = async (spaceId, userId) => {
  const sockets = await io.in(`space:${spaceId}`).fetchSockets();
  return !sockets.some((s) => s.user?.id === userId);
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins in development for LAN access
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
        if (!origin || allowed.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    // The Yjs server shares this HTTP server and may take longer than engine.io's
    // 1s default to answer its upgrade (it loads the doc from MongoDB first).
    destroyUpgrade: false,
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

    // Personal room for events aimed at one user regardless of which space they
    // are viewing (invites, notifications, losing access to a space).
    socket.join(`user:${socket.user.id}`);

    // Join a specific study space room
    socket.on('join_space', async (spaceId) => {
      try {
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

        // Send the joiner the full online list (this socket is already in the room)
        socket.emit('presence_state', { spaceId, online: await presenceFor(spaceId) });
      } catch (err) {
        console.error('Error joining space:', err.message);
        socket.emit('error_msg', { message: 'Failed to join space' });
      }
    });

    // Leave a specific study space room
    socket.on('leave_space', async (spaceId) => {
      socket.leave(`space:${spaceId}`);
      socket.to(`space:${spaceId}`).emit('user_stop_typing', { userId: socket.user.id });

      // Another tab of theirs may still have the space open
      if (await hasLeftRoom(spaceId, socket.user.id)) {
        socket.to(`space:${spaceId}`).emit('user_left', {
          userId: socket.user.id,
          name: socket.user.name,
        });
      }
    });

    // Handle Chat Messages — persist to MongoDB + broadcast
    socket.on('send_message', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const { spaceId, content, clientId } = data || {};

        if (!content || !content.trim() || !spaceId) {
          return reply({ error: 'Message is empty' });
        }

        // Checked against the DB, not socket.rooms: a message buffered while offline
        // is flushed on reconnect before the client has re-joined the room.
        const isMember = await Membership.exists({ spaceId, userId: socket.user.id });
        if (!isMember) {
          return reply({ error: 'Not a member of this space' });
        }

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

        // Broadcast to everyone else in the room (including the sender's other tabs);
        // the sender gets the saved message via the ack and swaps out its optimistic copy
        socket.to(`space:${spaceId}`).emit('receive_message', msgPayload);
        reply({ message: msgPayload });
      } catch (err) {
        console.error('Error saving message:', err.message);
        reply({ error: 'Failed to send message' });
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

    // Clear this user's typing indicator and mark them offline if they drop
    // without a leave_space (tab closed, network died).
    socket.on('disconnecting', async () => {
      const spaceRooms = [...socket.rooms].filter((r) => r.startsWith('space:'));

      for (const room of spaceRooms) {
        socket.to(room).emit('user_stop_typing', { userId: socket.user.id });
      }

      // `disconnecting` fires while this socket is still in its rooms, so wait for
      // it to actually leave before counting the user's remaining sockets.
      socket.once('disconnect', async () => {
        for (const room of spaceRooms) {
          const spaceId = room.slice('space:'.length);
          if (await hasLeftRoom(spaceId, socket.user.id)) {
            io.to(room).emit('user_left', {
              userId: socket.user.id,
              name: socket.user.name,
            });
          }
        }
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
  presenceFor,
};
