import type { Request, Response, NextFunction } from 'express'

/**
 * Adds basic security headers to every response.
 * For a production app handling sensitive data (payroll, background checks),
 * consider replacing this with the `helmet` package which is more comprehensive.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent browsers from MIME-sniffing the content type
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Deny framing entirely (clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY')

  // Don't send the Referer header to other origins
  res.setHeader('Referrer-Policy', 'no-referrer')

  // Disable the legacy XSS auditor — it can be exploited in some browsers
  res.setHeader('X-XSS-Protection', '0')

  // Only send HSTS in production so local dev still works over HTTP
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }

  next()
}
