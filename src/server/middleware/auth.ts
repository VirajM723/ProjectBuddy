import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config.js';

export interface AuthRequest extends Request {
  userId?: string;
}

const getUserId = (req: Request): string | undefined => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return undefined;
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
  return decoded.userId;
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.header('Authorization')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    req.userId = getUserId(req);
    if (!req.userId) throw new Error('No user');
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Attaches userId when a valid token is present, but never rejects the request
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.userId = getUserId(req);
  } catch {
    req.userId = undefined;
  }
  next();
};
