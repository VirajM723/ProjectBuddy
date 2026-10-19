import express from 'express';
import { ContributionLog } from '../models/ContributionLog.js';
import { Project } from '../models/Project.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validateId } from '../middleware/validateId.js';
import { cleanString, isValidId } from '../utils/validation.js';
import { isProjectMember } from '../utils/membership.js';

const router = express.Router();

// "Joined" logs are created by the server when a project is created or a member is accepted
const USER_LOG_TYPES = ['Milestone', 'Task', 'Completed'];
const POINTS: Record<string, number> = { Milestone: 3, Task: 1, Completed: 5 };

// Create log (project members only)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { projectId, contributionType } = req.body || {};
    if (!isValidId(projectId)) return res.status(400).json({ message: 'Invalid project ID' });
    if (!USER_LOG_TYPES.includes(contributionType)) {
      return res.status(400).json({ message: `Contribution type must be one of ${USER_LOG_TYPES.join(', ')}` });
    }
    const title = cleanString(req.body?.title, 200);
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!isProjectMember(project, req.userId)) {
      return res.status(403).json({ message: 'Only project members can log progress' });
    }

    const log = await ContributionLog.create({
      userId: req.userId,
      projectId,
      date: new Date().toISOString().split('T')[0],
      contributionType,
      title,
      details: cleanString(req.body?.details, 2000),
      points: POINTS[contributionType],
    });
    res.status(201).json(await log.populate('userId', 'name profileImage'));
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get logs for user
router.get('/user/:userId', validateId('userId'), async (req, res) => {
  try {
    const logs = await ContributionLog.find({ userId: req.params.userId })
      .populate('projectId', 'title')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get logs for project
router.get('/project/:projectId', validateId('projectId'), async (req, res) => {
  try {
    const logs = await ContributionLog.find({ projectId: req.params.projectId })
      .populate('userId', 'name profileImage')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
