import Anthropic from '@anthropic-ai/sdk'

// ─── Simple in-memory rate limiter ───────────────────────────────────────────
// Limits each IP to 30 requests per hour.
// Note: serverless functions can run in multiple instances, so this is
// per-instance — good enough to prevent obvious abuse, not a hard global cap.
const rateLimitMap = new Map()
const RATE_LIMIT    = 30          // max requests per window
const WINDOW_MS     = 60 * 60 * 1000 // 1 hour

function isRateLimited(ip) {
  const now   = Date.now()
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now }

  if (now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return false
  }

  if (entry.count >= RATE_LIMIT) return true

  rateLimitMap.set(ip, { ...entry, count: entry.count + 1 })
  return false
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Must be JSON
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' })
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests — try again in an hour.' })
  }

  // Validate body
  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt.' })
  }

  if (prompt.length > 12000) {
    return res.status(400).json({ error: 'Prompt too long.' })
  }

  // Guard: API key must exist server-side
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  // Call Anthropic — key is ONLY accessible here on the server
  try {
    const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model:     'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages:  [{ role: 'user', content: prompt }],
    })

    return res.status(200).json({ text: message.content[0].text })

  } catch (err) {
    console.error('Anthropic error:', err.message)

    if (err.status === 429) {
      return res.status(429).json({ error: 'AI is busy — please try again in a moment.' })
    }
    if (err.status === 401) {
      return res.status(500).json({ error: 'Server configuration error.' })
    }

    return res.status(500).json({ error: 'Generation failed — please try again.' })
  }
}
