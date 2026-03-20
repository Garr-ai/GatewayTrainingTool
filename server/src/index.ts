import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { router } from './routes'
import { errorHandler } from './middleware/error'
import { securityHeaders } from './middleware/security'

const app = express()

app.use(securityHeaders)
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
