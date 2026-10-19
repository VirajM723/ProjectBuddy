import express from 'express';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { validateId } from '../middleware/validateId.js';
import { cleanString, cleanStringArray, cleanUrl, cleanImage } from '../utils/validation.js';

const router = express.Router();

// Phone numbers are only visible to the user themself, admins, and people they share a project with
async function canSeeContactInfo(viewerId: string | undefined, targetId: string) {
  if (!viewerId) return false;
  if (viewerId === targetId) return true;
  const viewer = await User.findById(viewerId).select('role');
  if (viewer?.role === 'admin') return true;
  const shared = await Project.exists({
    $or: [
      { ownerId: viewerId, acceptedUsers: targetId },
      { ownerId: targetId, acceptedUsers: viewerId },
      { acceptedUsers: { $all: [viewerId, targetId] } },
    ],
  });
  return !!shared;
}

// Update profile (declared before '/:id' for clarity; only whitelisted fields are writable)
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const body = req.body || {};
    if ('name' in body) {
      const name = cleanString(body.name, 80);
      if (!name) return res.status(400).json({ message: 'Name cannot be empty' });
      user.name = name;
    }
    if ('bio' in body) user.bio = cleanString(body.bio, 1000);
    if ('phoneNumber' in body) user.phoneNumber = cleanString(body.phoneNumber, 30);
    if ('skills' in body) user.skills = cleanStringArray(body.skills, 30, 40);
    for (const field of ['resumeLink', 'githubLink', 'linkedinLink'] as const) {
      if (field in body) user[field] = cleanUrl(body[field]);
    }
    if ('profileImage' in body && body.profileImage !== user.profileImage) {
      const image = cleanImage(body.profileImage);
      if (body.profileImage && !image) {
        return res.status(400).json({ message: 'Profile image must be an image URL or an uploaded image under 1MB' });
      }
      if (image) user.profileImage = image;
    }

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get profile
router.get('/:id', optionalAuth, validateId('id'), async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const json = user.toJSON() as any;
    if (!(await canSeeContactInfo(req.userId, req.params.id))) {
      delete json.phoneNumber;
    }
    res.json(json);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
