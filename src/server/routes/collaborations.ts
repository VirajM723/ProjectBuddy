import express from 'express';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { ContributionLog } from '../models/ContributionLog.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { applicationLimiter } from '../middleware/rateLimiter.js';
import { validateId } from '../middleware/validateId.js';
import { cleanString, isValidId } from '../utils/validation.js';
import { isProjectMember, isProjectOwner } from '../utils/membership.js';

const router = express.Router();

// Create request
router.post('/', authMiddleware, applicationLimiter, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.body || {};
    const message = cleanString(req.body?.message, 1000);
    if (!isValidId(projectId)) return res.status(400).json({ message: 'Invalid project ID' });
    if (!message) return res.status(400).json({ message: 'Please include a message for the project owner' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (isProjectOwner(project, req.userId)) {
      return res.status(400).json({ message: 'You cannot apply to your own project' });
    }
    if (isProjectMember(project, req.userId)) {
      return res.status(400).json({ message: 'You are already a member of this project' });
    }
    if (project.status === 'Closed' || project.status === 'Completed') {
      return res.status(400).json({ message: `This project is ${project.status.toLowerCase()} and not accepting applications` });
    }

    const existing = await CollaborationRequest.findOne({ projectId, userId: req.userId, status: 'Pending' });
    if (existing) return res.status(400).json({ message: 'You already have a pending request for this project' });

    const request = await CollaborationRequest.create({ projectId, userId: req.userId, message });
    await Project.updateOne({ _id: projectId }, { $addToSet: { applicants: req.userId } });
    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating collaboration request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get requests for project
router.get('/project/:projectId', authMiddleware, validateId('projectId'), async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isProjectOwner(project, req.userId)) {
      return res.status(403).json({ message: 'User not authorized' });
    }

    const requests = await CollaborationRequest.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name profileImage bio skills');
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my (latest) request for project
router.get('/my-request/:projectId', authMiddleware, validateId('projectId'), async (req: AuthRequest, res) => {
  try {
    const request = await CollaborationRequest.findOne({ 
      projectId: req.params.projectId,
      userId: req.userId 
    }).sort({ createdAt: -1 });
    res.json(request || null);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status
router.put('/:id', authMiddleware, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body || {};
    if (status !== 'Accepted' && status !== 'Rejected') {
      return res.status(400).json({ message: 'Status must be Accepted or Rejected' });
    }

    const request = await CollaborationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const project = await Project.findById(request.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isProjectOwner(project, req.userId)) {
      return res.status(403).json({ message: 'User not authorized' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ message: `This request was already ${request.status.toLowerCase()}` });
    }

    request.status = status;
    await request.save();

    if (status === 'Accepted') {
      await Project.updateOne({ _id: project._id }, { $addToSet: { acceptedUsers: request.userId } });

      // Credit the new member (not the owner) with joining the project
      const member = await User.findById(request.userId).select('name');
      await ContributionLog.create({
        userId: request.userId,
        projectId: project._id,
        date: new Date().toISOString().split('T')[0],
        contributionType: 'Joined',
        title: `${member?.name || 'A new teammate'} joined the project`,
      });
    }

    res.json(request);
  } catch (error) {
    console.error('Error updating collaboration request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
