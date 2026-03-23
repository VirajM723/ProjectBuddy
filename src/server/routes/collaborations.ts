import express from 'express';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Project } from '../models/Project.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Create request
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { projectId, message } = req.body;
    const request = new CollaborationRequest({
      projectId,
      userId: req.userId,
      message,
    });
    await request.save();
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get requests for project
router.get('/project/:projectId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.ownerId.toString() !== req.userId) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const requests = await CollaborationRequest.find({ projectId: req.params.projectId }).populate('userId', 'name profileImage bio skills');
    res.json(requests);
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my request for project
router.get('/my-request/:projectId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const request = await CollaborationRequest.findOne({ 
      projectId: req.params.projectId,
      userId: req.userId 
    });
    res.json(request || null);
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const request = await CollaborationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const project = await Project.findById(request.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.ownerId.toString() !== req.userId) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    request.status = status;
    await request.save();

    if (status === 'Accepted') {
      project.acceptedUsers.push(request.userId);
      await project.save();
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
