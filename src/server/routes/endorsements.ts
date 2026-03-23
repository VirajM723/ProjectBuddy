import express from 'express';
import { Endorsement } from '../models/Endorsement.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Create endorsement
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { skill, endorsedUser } = req.body;
    const endorsement = new Endorsement({
      skill,
      endorsedBy: req.userId,
      endorsedUser,
    });
    await endorsement.save();
    res.status(201).json(endorsement);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get endorsements for user
router.get('/user/:userId', async (req, res) => {
  try {
    const endorsements = await Endorsement.find({ endorsedUser: req.params.userId }).populate('endorsedBy', 'name profileImage');
    res.json(endorsements);
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
