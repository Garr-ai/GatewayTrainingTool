import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { router } from './routes'
import { errorHandler } from './middleware/error'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
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
