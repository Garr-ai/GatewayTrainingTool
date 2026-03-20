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

// Stricter limiter for write operations that touch sensitive data
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later.' },
})

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : true,
    credentials: true,
  }),
)
// Explicit body size limit — prevents request body attacks; adjust if you need larger payloads
app.use(express.json({ limit: '50kb' }))
app.use('/api', router)
app.use(errorHandler)

// Local dev only — Vercel handles listening in production
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
  })
}

export default app
