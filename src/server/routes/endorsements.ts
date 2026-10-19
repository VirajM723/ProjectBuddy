import express from 'express';
import { Endorsement } from '../models/Endorsement.js';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validateId } from '../middleware/validateId.js';
import { cleanString, isValidId } from '../utils/validation.js';

const router = express.Router();

// Create endorsement
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { endorsedUser } = req.body || {};
    const skill = cleanString(req.body?.skill, 40);
    if (!isValidId(endorsedUser)) return res.status(400).json({ message: 'Invalid user ID' });
    if (!skill) return res.status(400).json({ message: 'Skill is required' });
    if (endorsedUser === req.userId) return res.status(400).json({ message: 'You cannot endorse yourself' });

    const target = await User.findById(endorsedUser).select('skills');
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!target.skills.includes(skill)) {
      return res.status(400).json({ message: 'This user does not list that skill' });
    }

    const existing = await Endorsement.findOne({ skill, endorsedBy: req.userId, endorsedUser });
    if (existing) return res.status(400).json({ message: 'You have already endorsed this skill' });

    const endorsement = await Endorsement.create({ skill, endorsedBy: req.userId, endorsedUser });
    res.status(201).json(await endorsement.populate('endorsedBy', 'name profileImage'));
  } catch (error) {
    console.error('Error creating endorsement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get endorsements for user
router.get('/user/:userId', validateId('userId'), async (req, res) => {
  try {
    const endorsements = await Endorsement.find({ endorsedUser: req.params.userId }).populate('endorsedBy', 'name profileImage');
    res.json(endorsements);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
