/**
 * server/src/middleware/security.ts — Manual security headers middleware
 *
 * NOTE: As of the current setup, `helmet` is already applied globally in index.ts
 * and covers all of these headers (and more). This file exists as a lightweight
 * alternative and reference. If helmet is removed, apply `securityHeaders` globally
 * in index.ts before the router.
 *
 * Headers set:
 *   X-Content-Type-Options: nosniff
 *     Prevents browsers from MIME-sniffing the response content-type, which could
 *     allow an attacker to serve malicious scripts disguised as other content types.
 *
 *   X-Frame-Options: DENY
 *     Blocks the page from being loaded inside an <iframe>, protecting against
 *     clickjacking attacks.
 *
 *   Referrer-Policy: no-referrer
 *     Prevents the browser from sending the Referer header to other origins,
 *     reducing information leakage when linking to external sites.
 *
 *   X-XSS-Protection: 0
 *     Explicitly disables the legacy browser XSS auditor (IE/old Chrome). The
 *     auditor itself can be exploited to cause XSS, so disabling it is recommended.
 *
 *   Strict-Transport-Security (production only)
 *     Tells browsers to always use HTTPS for 2 years (63072000 seconds).
 *     Only sent in production so local HTTP development still works.
 */

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
