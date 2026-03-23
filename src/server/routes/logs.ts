import express from 'express';
import { ContributionLog } from '../models/ContributionLog.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Create log
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { projectId, date, contributionType } = req.body;
    const log = new ContributionLog({
      userId: req.userId,
      projectId,
      date: date || new Date().toISOString().split('T')[0],
      contributionType,
    });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get logs for user
router.get('/user/:userId', async (req, res) => {
  try {
    const logs = await ContributionLog.find({ userId: req.params.userId }).populate('projectId', 'title');
    res.json(logs);
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
