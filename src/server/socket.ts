import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ChatRoom } from './models/ChatRoom.js';
import { Message } from './models/Message.js';
import { Project } from './models/Project.js';
import { JWT_SECRET } from './config.js';
import { cleanString, isValidId } from './utils/validation.js';
import { isProjectMember } from './utils/membership.js';
import { getOrCreateChatRoom } from './utils/chat.js';

// Simple per-socket flood protection: at most 20 messages per 10 seconds
const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 20;

export function setupSocket(io: Server) {
  // Middleware to authenticate socket connections using JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Support either clean token or Bearer token
    const tokenClean = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
    
    try {
      const decoded = jwt.verify(tokenClean, JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    let sentTimestamps: number[] = [];

    // Join a project room (projectId)
    socket.on('join_project_room', async (payload) => {
      try {
        const projectId = payload?.projectId;
        if (!isValidId(projectId)) {
          socket.emit('error_message', { message: 'Invalid project ID' });
          return;
        }

        // Verify if the user is authorized to join the room (must be project owner OR an accepted user)
        const project = await Project.findById(projectId);
        if (!project) {
          socket.emit('error_message', { message: 'Project not found' });
          return;
        }

        if (!isProjectMember(project, userId)) {
          socket.emit('error_message', { message: 'Access denied: You are not an accepted member of this project' });
          return;
        }

        const chatRoom = await getOrCreateChatRoom(project);

        // Physically join the Socket.io room matching the ChatRoom ID
        const roomId = chatRoom._id.toString();
        socket.join(roomId);

        // Latest 100 messages, oldest-first
        const pastMessages = (await Message.find({ roomId })
          .populate('senderId', 'name profileImage')
          .sort({ createdAt: -1 })
          .limit(100)).reverse();

        // Notify client they successfully joined
        socket.emit('room_joined', {
          roomId,
          projectId,
          messages: pastMessages
        });

      } catch (err) {
        console.error('Error in join_project_room:', err);
        socket.emit('error_message', { message: 'Failed to join chat room' });
      }
    });

    // Send a message
    socket.on('send_message', async (payload) => {
      try {
        const roomId = payload?.roomId;
        const text = cleanString(payload?.text, 2000);
        if (!isValidId(roomId) || !text) return;

        const now = Date.now();
        sentTimestamps = sentTimestamps.filter(t => now - t < MESSAGE_WINDOW_MS);
        if (sentTimestamps.length >= MESSAGE_LIMIT) {
          socket.emit('error_message', { message: 'You are sending messages too quickly' });
          return;
        }
        sentTimestamps.push(now);

        // Verify user belongs to this chat room
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
          socket.emit('error_message', { message: 'Chat room not found' });
          return;
        }

        const project = await Project.findById(chatRoom.projectId);
        if (!project) {
          socket.emit('error_message', { message: 'Project not found' });
          return;
        }

        if (!isProjectMember(project, userId)) {
          socket.emit('error_message', { message: 'Unauthorized: You are not a member of this project' });
          return;
        }

        const message = await Message.create({ roomId, senderId: userId, text });
        const populatedMessage = await message.populate('senderId', 'name profileImage');

        // Broadcast to all clients in the room including the sender
        io.to(roomId).emit('new_message', populatedMessage);

      } catch (err) {
        console.error('Error in send_message:', err);
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });
  });
}
