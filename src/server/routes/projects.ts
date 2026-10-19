import express from 'express';
import { Project } from '../models/Project.js';
import { ChatRoom } from '../models/ChatRoom.js';
import { Message } from '../models/Message.js';
import { ContributionLog } from '../models/ContributionLog.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { projectLimiter } from '../middleware/rateLimiter.js';
import { validateId } from '../middleware/validateId.js';
import { cleanString, cleanStringArray } from '../utils/validation.js';
import { isProjectMember, isProjectOwner } from '../utils/membership.js';
import { getOrCreateChatRoom } from '../utils/chat.js';
import * as h3 from 'h3-js';

const router = express.Router();

const PROJECT_STATUSES = ['Open', 'Closed', 'Ongoing', 'Completed', 'Reopened'];

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

const isValidCoords = (c: any): c is { lat: number; lng: number } =>
  c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;

// Builds the set of fields a project owner is allowed to write. Never includes ownerId/acceptedUsers.
function buildProjectFields(body: any, { partial }: { partial: boolean }) {
  const fields: Record<string, any> = {};
  const has = (key: string) => !partial || key in body;

  if (has('title')) fields.title = cleanString(body.title, 120);
  if (has('summary')) fields.summary = cleanString(body.summary, 300);
  if (has('description')) fields.description = cleanString(body.description, 10000);
  if (has('techStack')) fields.techStack = cleanStringArray(body.techStack);
  if (has('requiredRoles')) fields.requiredRoles = cleanStringArray(body.requiredRoles);
  if (has('commitmentLevel')) fields.commitmentLevel = cleanString(body.commitmentLevel, 50);
  if (has('projectType')) fields.projectType = cleanString(body.projectType, 50);
  if ('status' in body) {
    if (!PROJECT_STATUSES.includes(body.status)) throw new ValidationError('Invalid project status');
    fields.status = body.status;
  }
  if ('locationName' in body) fields.locationName = cleanString(body.locationName, 100);
  if ('locationCoords' in body) {
    if (isValidCoords(body.locationCoords)) {
      fields.locationCoords = { lat: body.locationCoords.lat, lng: body.locationCoords.lng };
      fields.h3Index = getH3Cell(body.locationCoords.lat, body.locationCoords.lng, 5);
    } else {
      fields.locationCoords = undefined;
      fields.h3Index = '';
    }
  }

  for (const key of ['title', 'summary', 'description', 'commitmentLevel', 'projectType']) {
    if (key in fields && !fields[key]) throw new ValidationError(`${key} is required`);
  }
  return fields;
}

class ValidationError extends Error {}

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
      .sort({ createdAt: -1 })
      .populate('ownerId', 'name profileImage')
      .populate('acceptedUsers', 'name profileImage');
    res.json(projects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create project
router.post('/', authMiddleware, projectLimiter, async (req: AuthRequest, res) => {
  try {
    const fields = buildProjectFields(req.body || {}, { partial: false });
    const project = await new Project({
      ...fields,
      status: fields.status || 'Open',
      ownerId: req.userId,
    }).save();

    // Credit the owner with a "Joined" contribution for starting the project
    await ContributionLog.create({
      userId: req.userId,
      projectId: project._id,
      date: new Date().toISOString().split('T')[0],
      contributionType: 'Joined',
      title: `Created the project "${project.title}"`,
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ message: error.message });
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', validateId('id'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('ownerId', 'name profileImage')
      .populate('acceptedUsers', 'name profileImage');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project (owner only)
router.put('/:id', authMiddleware, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isProjectOwner(project, req.userId)) {
      return res.status(403).json({ message: 'User not authorized' });
    }

    const fields = buildProjectFields(req.body || {}, { partial: true });
    project.set(fields);

    // Owners may set roles for members of their team, but not for strangers
    if (req.body?.userRoles && typeof req.body.userRoles === 'object') {
      for (const [memberId, role] of Object.entries(req.body.userRoles)) {
        if (isProjectMember(project, memberId)) {
          project.userRoles.set(memberId, cleanString(role, 50));
        }
      }
    }

    await project.save();
    await project.populate([
      { path: 'ownerId', select: 'name profileImage' },
      { path: 'acceptedUsers', select: 'name profileImage' },
    ]);
    res.json(project);
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ message: error.message });
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set your own role on a project you are a member of
router.put('/:id/role', authMiddleware, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!isProjectMember(project, req.userId)) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const role = cleanString(req.body?.role, 50);
    if (role) project.userRoles.set(req.userId!, role);
    else project.userRoles.delete(req.userId!);
    await project.save();

    res.json({ userRoles: Object.fromEntries(project.userRoles) });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET messages for a project chat room (REST fallback)
router.get('/:id/messages', authMiddleware, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isProjectMember(project, req.userId)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this project' });
    }

    const chatRoom = await getOrCreateChatRoom(project);

    // Latest 100 messages, returned oldest-first for display
    const messages = (await Message.find({ roomId: chatRoom._id })
      .populate('senderId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(100)).reverse();

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
router.post('/:id/messages', authMiddleware, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const text = cleanString(req.body?.text, 2000);
    if (!text) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isProjectMember(project, req.userId)) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this project' });
    }

    const chatRoom = await getOrCreateChatRoom(project);

    const message = await Message.create({
      roomId: chatRoom._id,
      senderId: req.userId,
      text,
    });
    const populatedMessage = await message.populate('senderId', 'name profileImage');

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
