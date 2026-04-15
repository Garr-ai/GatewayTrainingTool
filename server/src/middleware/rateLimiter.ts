/**
 * server/src/middleware/rateLimiter.ts — Shared rate limiter instances
 *
 * Extracted from index.ts so route files can import writeLimiter without
 * creating a circular dependency (index.ts → routes → index.ts).
 *
 * globalLimiter: applied to every request in index.ts (500 req/15min)
 * writeLimiter:  applied to POST/PUT/DELETE on sensitive data (100 req/15min)
 */

import { rateLimit } from 'express-rate-limit'

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later.' },
})
