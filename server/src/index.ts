/**
 * server/src/index.ts — Express application entry point
 *
 * Bootstraps the Express server with all global middleware and mounts the
 * main API router at `/api`. This file is the only place global middleware
 * is registered; per-route middleware lives in the route files.
 *
 * Middleware stack (in order of application):
 *   1. helmet         — Sets comprehensive security response headers
 *   2. globalLimiter  — Rate limits all requests to 100/15min per IP
 *   3. cors           — Allows the frontend origin; unrestricted in dev
 *   4. express.json   — Parses JSON bodies (hard-capped at 50 KB)
 *   5. /api router    — All API routes (auth, coordinator checks inside)
 *   6. errorHandler   — Catches any thrown errors and returns JSON 500
 *
 * Deployment:
 *   - In development: the server listens on PORT (default 3001).
 *   - In production (Vercel): Vercel's serverless adapter handles listening;
 *     the `app.listen()` block is skipped via the NODE_ENV check.
 *
 * The exported `writeLimiter` is used by route files that perform
 * write operations on sensitive data (e.g. reports, hours) to apply
 * a stricter 30 requests/15min limit on those endpoints.
 *
 * Required environment variables (server/.env):
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
 *   FRONTEND_URL              — Production frontend origin for CORS (e.g. https://app.example.com)
 *   NODE_ENV                  — "production" or "development"
 *   PORT                      — (optional) local dev port, defaults to 3001
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { router } from './routes'
import { errorHandler } from './middleware/error'

const app = express()

// Security headers — helmet covers HSTS, X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, X-XSS-Protection, Content-Security-Policy, and more.
app.use(helmet())

// Rate limiting — applied globally. Adjust windowMs/limit per-route for sensitive endpoints.
// These defaults allow 100 requests per 15 min per IP, suitable for an internal tool.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
app.use(globalLimiter)

/**
 * Stricter rate limiter for write operations on sensitive data (reports, hours).
 * Exported so individual route files can apply it to their POST/PUT/DELETE handlers.
 * 30 requests per 15 min per IP — tighter than the global limit.
 */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later.' },
})

app.use(
  cors({
    // In production, only allow requests from the configured frontend URL.
    // In development, allow all origins (true) so local dev works without configuration.
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : true,
    credentials: true,
  }),
)
// Explicit body size limit — prevents request body attacks; adjust if you need larger payloads
app.use(express.json({ limit: '50kb' }))
app.use('/api', router)
// Global error handler — must be registered AFTER routes
app.use(errorHandler)

// Local dev only — Vercel handles listening in production via its serverless adapter
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
  })
}

export default app
