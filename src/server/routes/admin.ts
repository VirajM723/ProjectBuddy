import express from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { ContributionLog } from '../models/ContributionLog.js';
import { Endorsement } from '../models/Endorsement.js';
import { ChatRoom } from '../models/ChatRoom.js';
import { Message } from '../models/Message.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validateId } from '../middleware/validateId.js';

const router = express.Router();

// Admin middleware
const adminMiddleware = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

router.use(authMiddleware, adminMiddleware);

// Removes a project and everything that hangs off it
async function deleteProjectCascade(projectIds: Types.ObjectId[]) {
  if (projectIds.length === 0) return;
  const rooms = await ChatRoom.find({ projectId: { $in: projectIds } }).select('_id');
  await Promise.all([
    Message.deleteMany({ roomId: { $in: rooms.map(r => r._id) } }),
    ChatRoom.deleteMany({ projectId: { $in: projectIds } }),
    CollaborationRequest.deleteMany({ projectId: { $in: projectIds } }),
    ContributionLog.deleteMany({ projectId: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
  ]);
}

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).populate('ownerId', 'name');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (and the projects they own, plus their activity)
router.delete('/users/:id', validateId('id'), async (req: AuthRequest, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const owned = await Project.find({ ownerId: user._id }).select('_id');
    await deleteProjectCascade(owned.map(p => p._id));
    await Promise.all([
      Project.updateMany({}, { $pull: { acceptedUsers: user._id, applicants: user._id } }),
      CollaborationRequest.deleteMany({ userId: user._id }),
      ContributionLog.deleteMany({ userId: user._id }),
      Endorsement.deleteMany({ $or: [{ endorsedBy: user._id }, { endorsedUser: user._id }] }),
      Message.deleteMany({ senderId: user._id }),
    ]);
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete project
router.delete('/projects/:id', validateId('id'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).select('_id');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    await deleteProjectCascade([project._id]);
    res.json({ message: 'Project deleted' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
