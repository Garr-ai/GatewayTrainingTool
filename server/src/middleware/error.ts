/**
 * server/src/middleware/error.ts — Global Express error handler
 *
 * This is the last middleware registered in index.ts (after all routes).
 * Express calls this 4-argument function whenever a route calls `next(err)`.
 *
 * Behaviour:
 *   - Always logs the full error to stderr (for server-side monitoring)
 *   - In development: returns the original error message in the response body
 *     so developers can see exactly what went wrong without checking server logs
 *   - In production: returns a generic "Internal server error" message to avoid
 *     leaking stack traces, table names, or internal details to the client
 *
 * The `_req` and `_next` parameters are prefixed with `_` to signal they are
 * intentionally unused (required by Express's error handler signature).
 */

import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Always log the full error server-side for diagnostics
  console.error(err)
  const isProd = process.env.NODE_ENV === 'production'
  // In production, hide internal details. In dev, expose the error message.
  const message = isProd
    ? 'Internal server error'
    : err instanceof Error
      ? err.message
      : 'Internal server error'
  res.status(500).json({ error: message })
}
