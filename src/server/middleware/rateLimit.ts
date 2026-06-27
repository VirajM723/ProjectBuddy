import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: {
  windowMs: number; // e.g. 60000 for 1 minute
  max: number;      // e.g. 10 requests
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Identify client by IP, or by user ID if logged in (from authMiddleware)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).userId || '';
    const key = `${userId ? `user_${userId}` : `ip_${ip}`}:${req.originalUrl || req.path}`;
    
    const now = Date.now();
    const clientLimit = store[key];

    if (!clientLimit || clientLimit.resetTime < now) {
      // Create new window
      store[key] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - 1);
      res.setHeader('X-RateLimit-Reset', new Date(now + options.windowMs).toISOString());
      
      return next();
    }

    clientLimit.count += 1;
    const remaining = Math.max(0, options.max - clientLimit.count);
    
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(clientLimit.resetTime).toISOString());

    if (clientLimit.count > options.max) {
      return res.status(429).json({
        message: options.message || 'Too many requests from this client, please try again later.',
      });
    }

    next();
  };
}

// Pre-defined limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // Max 15 register/login attempts per 5 minutes
  message: 'Too many authentication attempts, please try again in 5 minutes.',
});

export const creationRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Max 5 projects or requests created per minute
  message: 'Slow down! You can only create 5 entries per minute.',
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 API requests per minute for general routes
  message: 'Rate limit exceeded, please wait a minute.',
});
