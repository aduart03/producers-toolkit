import { useState } from 'react'
import './App.css'
import Anthropic from '@anthropic-ai/sdk'


const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
})

const MODES = [
  {
    id: 'start',
    label: '🎹 Start From Nothing',
    description: 'Blank canvas? Tell me the vibe and I\'ll give you a direction.',
    placeholder: 'e.g. I want to make a dark UK garage track, around 130 BPM, something that feels late night...',
    prompt: (input) => `You are a music producer assistant with deep knowledge of electronic music. A producer is starting from scratch and needs creative direction. Be specific, practical, and inspiring. Give them: a suggested BPM range, a key/scale, a chord progression idea, a song structure to try, 2-3 reference tracks to aim for, and one unique element that would make this track stand out. Keep it concise and actionable. Their vibe: ${input}`
  },
  {
    id: 'stuck',
    label: '🔁 I Have Something',
    description: 'Got a loop or idea but don\'t know where to take it.',
    placeholder: 'e.g. I have a 4-bar loop with a bassline and chords, not sure what to add next...',
    prompt: (input) => `You are a music producer assistant. A producer has something started but is stuck on where to take it. Give them specific, practical next steps. Suggest what section to build next, what element might be missing, how to build energy, and what to try in their DAW. Be conversational and direct, like a producer friend giving real advice. What they have: ${input}`
  },
  {
    id: 'lyrics',
    label: '✍️ Lyric Concepts',
    description: 'Not writing lyrics for you — giving you raw ideas to make your own.',
    placeholder: 'e.g. I want to write something about leaving a city behind, UK garage vibe...',
    prompt: (input) => `You are helping a music producer find their lyrical voice. DO NOT write actual lyrics or full lines. Instead give them: 3-4 raw themes or angles to explore, some vivid imagery or metaphors that fit the mood, a few emotional tensions or contradictions to write from, and a suggested perspective (first person reflection, second person address, etc). The goal is to spark THEIR writing, not replace it. Keep it raw and real, not cheesy. Their concept: ${input}`
  },
  {
    id: 'sounds',
    label: '🎧 Sound Discovery',
    description: 'Find new sounds and samples beyond your usual spots.',
    placeholder: 'e.g. I mainly use Splice but keep using the same sounds. I make speed garage and techno...',
    prompt: (input) => `You are a music producer assistant helping someone discover new sounds and samples. Suggest specific platforms beyond Splice, specific search terms to use, specific types of sounds they might not have tried, free resources, and creative techniques for getting more out of sounds they already have. Be specific with platform names, pack names if you know them, and practical tips. Their situation: ${input}`
  },
]

function App() {
  const [activeMode, setActiveMode] = useState(null)
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const currentMode = MODES.find(m => m.id === activeMode)

  const getIdeas = async () => {
    setLoading(true)
    setResult('')
    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: currentMode.prompt(input)
          }
        ]
      })
      setResult(message.content[0].text)
    } catch (error) {
      setResult('Something went wrong. Check your API key and try again.')
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <h1 className="text-4xl font-bold mb-2">Producer's Toolkit</h1>
        <p className="text-gray-400 mb-8">Your creative assistant for when you're stuck, starting, or searching.</p>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                setActiveMode(mode.id)
                setInput('')
                setResult('')
              }}
              className={`p-4 rounded-xl text-left border transition-all ${
                activeMode === mode.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="font-semibold mb-1">{mode.label}</div>
              <div className="text-sm text-gray-400">{mode.description}</div>
            </button>
          ))}
        </div>

        {/* Input Area */}
        {activeMode && (
          <div className="mb-6">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={currentMode.placeholder}
              rows={4}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
            />
            <button
              onClick={getIdeas}
              disabled={!input.trim() || loading}
              className="mt-3 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all"
            >
              {loading ? 'Thinking...' : 'Get Ideas'}
            </button>
          </div>
        )}

        {/* Result Area */}
        {result && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-300 whitespace-pre-wrap">{result}</p>
          </div>
        )}

      </div>
    </div>
  )
}

export default App