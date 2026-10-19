import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

const userOrIpKey = (req: Request) => (req as any).userId || ipKeyGenerator(req.ip || 'unknown');

// 0. General API limiter: protects every endpoint from floods.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down and try again in a minute." }
});

// 1a. Login Limiter: Max 10 failed login attempts per 15 minutes per IP (successful logins don't count).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You have made too many failed login attempts. Please wait 15 minutes." }
});

// 1b. Register Limiter: Max 10 sign-ups per hour per IP.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many accounts created from this network. Please try again later." }
});

// 2. Project Limit: Max 5 project creations per day per user (using auth token userId).
export const projectLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { message: "You have exceeded the daily limit of 5 project creations. Please try again tomorrow." }
});

// 3. Application Limit: Max 10 collaboration requests per hour per user.
export const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { message: "You have exceeded the limit of 10 collaboration requests per hour. Please wait an hour." }
});
