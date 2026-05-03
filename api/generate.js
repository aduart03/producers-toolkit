import Anthropic from '@anthropic-ai/sdk'

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map()
const RATE_LIMIT   = 30
const WINDOW_MS    = 60 * 60 * 1000

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

export const config = {
  api: { responseLimit: false },
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!req.headers['content-type']?.includes('application/json'))
    return res.status(415).json({ error: 'Content-Type must be application/json' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown'
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests — try again in an hour.' })

  // Accept either a single prompt or a full messages array (for conversation)
  const { prompt, messages } = req.body

  if (!prompt && !messages) return res.status(400).json({ error: 'Missing prompt or messages.' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server configuration error.' })

  const messageArray = messages || [{ role: 'user', content: prompt }]

  // Validate
  const totalLength = messageArray.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  if (totalLength > 40000) return res.status(400).json({ error: 'Messages too long.' })

  // ── Stream back via SSE ───────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = client.messages.stream({
      model:     'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages:  messageArray,
    })

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`)
    })

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    })

    await stream.finalMessage()
    res.write('data: [DONE]\n\n')
    res.end()

  } catch (err) {
    console.error('Anthropic error:', err.message)
    res.write(`data: ${JSON.stringify({ error: 'Generation failed — please try again.' })}\n\n`)
    res.end()
  }
}
