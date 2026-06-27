import express from 'express';
import { Project } from '../models/Project.js';
import { ChatRoom } from '../models/ChatRoom.js';
import { Message } from '../models/Message.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { projectLimiter } from '../middleware/rateLimiter.js';
import * as h3 from 'h3-js';

const router = express.Router();

// Helper to safely get H3 cells in a version-agnostic/resilient way
function getH3Cell(lat: number, lng: number, res: number = 5): string {
  try {
    if (typeof h3.latLngToCell === 'function') {
      return h3.latLngToCell(lat, lng, res);
    } else if (typeof (h3 as any).geoToH3 === 'function') {
      return (h3 as any).geoToH3(lat, lng, res);
    }
  } catch (err) {
    console.error('Error calculating H3 cell:', err);
  }
  return '';
}

// Helper to safely get H3 disk/neighbors in a version-agnostic/resilient way
function getH3Disk(cell: string, k: number = 2): string[] {
  try {
    if (typeof h3.gridDisk === 'function') {
      return h3.gridDisk(cell, k);
    } else if (typeof (h3 as any).kRing === 'function') {
      return (h3 as any).kRing(cell, k);
    }
  } catch (err) {
    console.error('Error calculating H3 disk:', err);
  }
  return [cell];
}

// Get all projects (supports location query filtering)
router.get('/', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    let query: any = {};
    
    if (lat && lng) {
      const uLat = parseFloat(lat as string);
      const uLng = parseFloat(lng as string);
      if (!isNaN(uLat) && !isNaN(uLng)) {
        const userCell = getH3Cell(uLat, uLng, 5);
        if (userCell) {
          const cells = getH3Disk(userCell, 2); // k-ring of 2 covers the surrounding area/region
          query.h3Index = { $in: cells };
        }
      }
    }

    const projects = await Project.find(query)
      .populate('ownerId', 'name profileImage')
      .populate('acceptedUsers', 'name profileImage');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create project
router.post('/', authMiddleware, projectLimiter, async (req: AuthRequest, res) => {
  try {
    const { locationCoords, ...otherBody } = req.body;
    let h3Index = '';
    
    if (locationCoords && typeof locationCoords.lat === 'number' && typeof locationCoords.lng === 'number') {
      h3Index = getH3Cell(locationCoords.lat, locationCoords.lng, 5);
    }

    const newProject = new Project({
      ...otherBody,
      locationCoords,
      h3Index,
      ownerId: req.userId,
    });
    const project = await newProject.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('ownerId', 'name profileImage')
      .populate('acceptedUsers', 'name profileImage');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.ownerId.toString() !== req.userId) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET messages for a project chat room (REST fallback)
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isOwner = project.ownerId.toString() === req.userId;
    const isAccepted = project.acceptedUsers.some(u => u.toString() === req.userId);

    if (!isOwner && !isAccepted) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this project' });
    }

    let chatRoom = await ChatRoom.findOne({ projectId });
    if (!chatRoom) {
      chatRoom = new ChatRoom({
        projectId,
        members: [project.ownerId, ...project.acceptedUsers]
      });
      await chatRoom.save();
    }

    const messages = await Message.find({ roomId: chatRoom._id })
      .populate('senderId', 'name profileImage')
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({
      chatRoomId: chatRoom._id,
      messages
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST a message to a project chat room (REST fallback)
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isOwner = project.ownerId.toString() === req.userId;
    const isAccepted = project.acceptedUsers.some(u => u.toString() === req.userId);

    if (!isOwner && !isAccepted) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this project' });
    }

    let chatRoom = await ChatRoom.findOne({ projectId });
    if (!chatRoom) {
      chatRoom = new ChatRoom({
        projectId,
        members: [project.ownerId, ...project.acceptedUsers]
      });
      await chatRoom.save();
    }

    const message = new Message({
      roomId: chatRoom._id,
      senderId: req.userId,
      text: text.trim()
    });
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name profileImage');

    // Broadcast to web socket users (instant sync for other teammates)
    const io = req.app.get('io');
    if (io) {
      io.to(chatRoom._id.toString()).emit('new_message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error creating chat message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
