import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ChatRoom } from './models/ChatRoom.js';
import { Message } from './models/Message.js';
import { Project } from './models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export function setupSocket(io: Server) {
  // Middleware to authenticate socket connections using JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) {
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
    console.log(`Socket user connected: ${userId} (${socket.id})`);

    // Join a project room (projectId)
    socket.on('join_project_room', async ({ projectId }) => {
      try {
        if (!projectId) return;

        // Verify if the user is authorized to join the room (must be project owner OR an accepted user)
        const project = await Project.findById(projectId);
        if (!project) {
          socket.emit('error_message', { message: 'Project not found' });
          return;
        }

        const isOwner = project.ownerId.toString() === userId;
        const isAccepted = project.acceptedUsers.some(u => u.toString() === userId);

        if (!isOwner && !isAccepted) {
          socket.emit('error_message', { message: 'Access denied: You are not an accepted member of this project' });
          return;
        }

        // Get or create the physical MongoDB ChatRoom for this project
        let chatRoom = await ChatRoom.findOne({ projectId });
        if (!chatRoom) {
          chatRoom = new ChatRoom({
            projectId,
            members: [project.ownerId, ...project.acceptedUsers]
          });
          await chatRoom.save();
        } else {
          // Sync members just in case new members were joined recently
          const currentMembers = [project.ownerId.toString(), ...project.acceptedUsers.map(u => u.toString())];
          const dbMembers = chatRoom.members.map(m => m.toString());
          
          const needsSync = currentMembers.some(m => !dbMembers.includes(m)) || dbMembers.length !== currentMembers.length;
          if (needsSync) {
            chatRoom.members = [project.ownerId, ...project.acceptedUsers] as any;
            await chatRoom.save();
          }
        }

        // Physically join the Socket.io room matching the ChatRoom ID
        const roomId = chatRoom._id.toString();
        socket.join(roomId);

        // Fetch past messages
        const pastMessages = await Message.find({ roomId })
          .populate('senderId', 'name profileImage')
          .sort({ createdAt: 1 })
          .limit(100);

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
    socket.on('send_message', async ({ roomId, text }) => {
      try {
        if (!roomId || !text || !text.trim()) return;

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

        const isOwner = project.ownerId.toString() === userId;
        const isAccepted = project.acceptedUsers.some(u => u.toString() === userId);
        if (!isOwner && !isAccepted) {
          socket.emit('error_message', { message: 'Unauthorized: You are not a member of this project' });
          return;
        }

        // Save message to database
        const message = new Message({
          roomId,
          senderId: userId,
          text: text.trim()
        });
        await message.save();

        // Populate message sender profile and broadcast
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name profileImage');

        // Broadcast to all clients in the room including the sender
        io.to(roomId).emit('new_message', populatedMessage);

      } catch (err) {
        console.error('Error in send_message:', err);
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket user disconnected: ${userId} (${socket.id})`);
    });
  });
}
