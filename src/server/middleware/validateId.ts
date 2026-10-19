import { Request, Response, NextFunction } from 'express';
import { isValidId } from '../utils/validation.js';

// Rejects malformed ObjectIds with a 400 before they reach Mongoose and surface as 500s
export const validateId = (...params: string[]) => (req: Request, res: Response, next: NextFunction) => {
  for (const param of params) {
    if (!isValidId(req.params[param])) {
      return res.status(400).json({ message: `Invalid ${param}` });
    }
  }
  next();
};
