import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// 1. Auth Limiter: Max 10 login/register attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: "You have made too many authentication attempts. Please wait 15 minutes." }
});

// 2. Project Limit: Max 5 project creations per day per user (using auth token userId).
export const projectLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).userId || req.ip || 'unknown',
  validate: { trustProxy: false },
  message: { message: "You have exceeded the daily limit of 5 project creations. Please try again tomorrow." }
});

// 3. Application Limit: Max 10 collaboration requests per hour per user.
export const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).userId || req.ip || 'unknown',
  validate: { trustProxy: false },
  message: { message: "You have exceeded the limit of 10 collaboration requests per hour. Please wait an hour." }
});
