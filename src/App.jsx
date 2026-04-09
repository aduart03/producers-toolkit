import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import MidiWriter from 'midi-writer-js'
import './App.css'

// ─── Rotating loading messages ───────────────────────────────────────────────
const LOADING_MSGS = {
  start:    ['Thinking...', 'Setting the vibe...', 'Building your brief...', 'Finding reference tracks...'],
  stuck:    ['Thinking...', 'Listening to your idea...', 'Finding directions...', 'Mapping the energy arc...'],
  lyrics:   ['Thinking...', 'Finding the feeling...', 'Crafting themes...', 'Digging for imagery...'],
  sounds:   ['Thinking...', 'Digging through crates...', 'Hunting for gems...', 'Checking the archives...'],
  mix:      ['Thinking...', 'Analysing the mix...', 'Calculating EQ moves...', 'Running the numbers...'],
  design:   ['Thinking...', 'Designing the patch...', 'Tweaking parameters...', 'Building the FX chain...'],
  generate: ['Thinking...', 'Drafting the brief...', 'Writing prompts...', 'Composing the structure...'],
  sample:   ['Thinking...', 'Reading the waveform...', 'Analysing frequencies...', 'Checking the dynamics...'],
}

// ─── Follow-up suggestions per mode ──────────────────────────────────────────
const FOLLOW_UPS = {
  start:    ['Make it darker and more minimal', 'Give me the sound design for the main synth', 'Write lyric concepts for this vibe', 'What\'s a unique element to make it stand out?'],
  stuck:    ['Go deeper on the first direction', 'How do I build tension before the drop?', 'What should the breakdown sound like?', 'How do I end the track?'],
  lyrics:   ['Give me darker, more paranoid imagery', 'Make it more introspective and emotional', 'Give me hook fragment ideas for this', 'Which artist\'s style fits this best?'],
  sounds:   ['Give me more free options only', 'How do I flip these samples creatively?', 'Where do I find vocal samples specifically?', 'What about drum breaks?'],
  mix:      ['Go deeper on the low end', 'How do I make the mix louder without clipping?', 'What about the stereo width?', 'Give me the mastering chain for this'],
  design:   ['Make it warmer and more vintage', 'How do I add movement to this sound?', 'Give me the FX chain in more detail', 'How do I make it more unique?'],
  generate: ['Make it more minimal and late night', 'Give me a darker version of this', 'What would the breakdown sound like?', 'Generate a Suno prompt for the intro only'],
  sample:   ['What compressor should I use?', 'How do I make it sit better in the mix?', 'Is there a free plugin that can fix this?', 'What should I do with the stereo field?'],
}

// ─── Streaming API call ───────────────────────────────────────────────────────
// Dev: streams directly from Anthropic SDK
// Prod: streams from /api/generate via Server-Sent Events
// onChunk(text) is called for each token as it arrives
const callAI = async (messages, onChunk) => {
  if (import.meta.env.DEV) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true })
    let full = ''
    const stream = client.messages.stream({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages })
    stream.on('text', (t) => { full += t; onChunk(t) })
    await stream.finalMessage()
    return full
  }

  // Production — SSE stream from serverless function
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return full
      try { const { text } = JSON.parse(data); full += text; onChunk(text) } catch {}
    }
  }
  return full
}

// ─── Chord voicings ───────────────────────────────────────────────────────────
const CHORD_VOICINGS = {
  'C':  ['C4','E4','G4'],   'Cm':  ['C4','Eb4','G4'],
  'D':  ['D4','F#4','A4'],  'Dm':  ['D4','F4','A4'],
  'E':  ['E3','G#3','B3'],  'Em':  ['E3','G3','B3'],
  'F':  ['F3','A3','C4'],   'Fm':  ['F3','Ab3','C4'],
  'G':  ['G3','B3','D4'],   'Gm':  ['G3','Bb3','D4'],
  'A':  ['A3','C#4','E4'],  'Am':  ['A3','C4','E4'],
  'Bb': ['Bb3','D4','F4'],  'Bbm': ['Bb3','Db4','F4'],
  'B':  ['B3','D#4','F#4'], 'Bm':  ['B3','D4','F#4'],
  'F#m':['F#3','A3','C#4'], 'C#m': ['C#4','E4','G#4'],
  'Ab': ['Ab3','C4','Eb4'], 'Eb':  ['Eb3','G3','Bb3'],
}

const CHORD_TYPES = ['Pad', 'Pluck', 'Lead Synth', 'Stab', 'Arp', 'Piano', 'Rhodes', 'Bass']
const SYNTHS      = ['Serum 2', 'Serum', 'Vital (free)', 'Sylenth1', 'Massive X', 'Phase Plant', 'Pigments', 'Diva', 'Surge XT (free)']
const MIDI_TYPES  = [
  { id: 'chord',  label: '🎹 Chords',   desc: 'Chord progression' },
  { id: 'melody', label: '🎵 Melody',   desc: 'Lead melody line'  },
  { id: 'bass',   label: '🔉 Bassline', desc: 'Bass pattern'       },
]

const MODES = [
  { id: 'start',    label: '🎹 Start From Nothing', desc: 'Blank canvas direction'    },
  { id: 'stuck',    label: '🔁 I Have Something',   desc: 'Get unstuck on your loop' },
  { id: 'lyrics',   label: '✍️ Lyric Concepts',      desc: 'Raw themes, not cheesy AI' },
  { id: 'sounds',   label: '🎧 Sound Discovery',     desc: 'Beyond Splice'             },
  { id: 'mix',      label: '🎚️ Mix Advice',           desc: 'Surgical EQ & plugin tips' },
  { id: 'design',   label: '🔊 Sound Design',         desc: 'Recreate any sound'        },
  { id: 'generate', label: '🎵 Generate Track',       desc: 'Suno/Udio prompt + brief'  },
  { id: 'sample',   label: '🎙️ Analyse Sample',       desc: 'Upload audio for real analysis' },
]

// ─── MIDI generation ──────────────────────────────────────────────────────────
const generateChordMidi = (chords, bpm) => {
  const track = new MidiWriter.Track()
  track.setTempo(bpm || 130)
  chords.forEach(chord => {
    const notes = CHORD_VOICINGS[chord] || CHORD_VOICINGS['Am']
    track.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: '1', velocity: 75 }))
  })
  return new MidiWriter.Writer(track).dataUri()
}

const generateNoteMidi = (notes, bpm) => {
  const track = new MidiWriter.Track()
  track.setTempo(bpm || 130)
  notes.forEach(note => {
    track.addEvent(new MidiWriter.NoteEvent({ pitch: [note], duration: 'q', velocity: 80 }))
  })
  return new MidiWriter.Writer(track).dataUri()
}

// ─── MIDI parsing ─────────────────────────────────────────────────────────────
const parseMidiLine = (text) => {
  const chordMatch  = text.match(/MIDI:\s*([\w#b]+(?:-[\w#b]+)*)\s+BPM:\s*(\d+)/i)
  if (chordMatch)  return { type: 'chord',  notes: chordMatch[1].split('-'),  bpm: parseInt(chordMatch[2]) }
  const melodyMatch = text.match(/MELODY:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (melodyMatch) return { type: 'melody', notes: melodyMatch[1].split('-'), bpm: parseInt(melodyMatch[2]) }
  const bassMatch   = text.match(/BASS:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (bassMatch)   return { type: 'bass',   notes: bassMatch[1].split('-'),   bpm: parseInt(bassMatch[2]) }
  return null
}

const cleanResult = (text) =>
  text
    .replace(/MIDI:.*BPM:\s*\d+/gi, '')
    .replace(/MELODY:.*BPM:\s*\d+/gi, '')
    .replace(/BASS:.*BPM:\s*\d+/gi, '')
    .trim()

// ─── Web Audio analysis ───────────────────────────────────────────────────────
const analyzeAudioFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

  let audioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    await audioCtx.close()
    throw new Error('Could not decode audio — try MP3 or WAV.')
  }

  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null
  const sr  = audioBuffer.sampleRate

  // Peak, RMS, clipping
  let sumSq = 0, peak = 0, clipped = 0
  for (let i = 0; i < ch0.length; i++) {
    const abs = Math.abs(ch0[i])
    if (abs > peak) peak = abs
    sumSq += ch0[i] ** 2
    if (abs > 0.99) clipped++
  }
  const rmsDb  = peak > 0 ? Math.round(20 * Math.log10(Math.sqrt(sumSq / ch0.length))) : -96
  const peakDb = peak > 0 ? Math.round(20 * Math.log10(peak)) : -96

  // Stereo correlation → width estimate
  let stereoWidth = 'Mono'
  if (ch1) {
    const limit = Math.min(ch0.length, 100000)
    let sumLR = 0, sumL2 = 0, sumR2 = 0
    for (let i = 0; i < limit; i++) {
      sumLR += ch0[i] * ch1[i]
      sumL2 += ch0[i] ** 2
      sumR2 += ch1[i] ** 2
    }
    const corr = sumLR / Math.sqrt(sumL2 * sumR2)
    const pct  = Math.round((1 - Math.abs(corr)) * 100)
    stereoWidth = pct < 10 ? 'Near mono (very narrow)' :
                  pct < 30 ? 'Narrow stereo' :
                  pct < 60 ? 'Medium stereo width' : 'Wide stereo'
  }

  // Frequency energy via Goertzel on a windowed segment
  const winSize  = Math.min(8192, ch0.length)
  const mid      = Math.floor((ch0.length - winSize) / 2)
  const segment  = ch0.slice(mid, mid + winSize)
  const windowed = new Float32Array(winSize)
  for (let i = 0; i < winSize; i++) {
    windowed[i] = segment[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (winSize - 1)))
  }

  const goertzel = (samples, freq) => {
    const N     = samples.length
    const k     = Math.round(N * freq / sr)
    if (k <= 0 || k >= N / 2) return 0
    const coeff = 2 * Math.cos(2 * Math.PI * k / N)
    let s1 = 0, s2 = 0
    for (let i = 0; i < N; i++) {
      const s = samples[i] + coeff * s1 - s2
      s2 = s1; s1 = s
    }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - s1 * s2 * coeff))
  }

  const BANDS = [
    { name: 'Sub (20-60 Hz)',        freq: 40    },
    { name: 'Bass (60-250 Hz)',      freq: 120   },
    { name: 'Low-mid (250-500 Hz)',  freq: 350   },
    { name: 'Mid (500 Hz-2 kHz)',    freq: 1000  },
    { name: 'High-mid (2-6 kHz)',    freq: 3500  },
    { name: 'Presence (6-12 kHz)',   freq: 9000  },
    { name: 'Air (12 kHz+)',         freq: 16000 },
  ]
  const energies = BANDS.map(b => ({ name: b.name, e: goertzel(windowed, b.freq) }))
  const maxE     = Math.max(...energies.map(b => b.e), 0.00001)
  const bands    = energies.map(b => ({ name: b.name, pct: Math.round((b.e / maxE) * 100) }))

  await audioCtx.close()

  return {
    filename:  file.name,
    duration:  audioBuffer.duration.toFixed(2) + 's',
    sampleRate: sr + ' Hz',
    channels:  audioBuffer.numberOfChannels === 1 ? 'Mono' : 'Stereo',
    stereoWidth,
    peakDb:    peakDb + ' dBFS',
    rmsDb:     rmsDb  + ' dBFS',
    dynRange:  (peakDb - rmsDb) + ' dB',
    clipping:  clipped > 0
      ? `⚠️ YES — ${clipped} clipped samples` : 'None detected',
    bands,
  }
}

const analysisToPrompt = (analysis, instrumentType, extraDesc) => {
  const bandStr = analysis.bands.map(b => `  ${b.name}: ${b.pct}%`).join('\n')
  return `You are a professional mixing engineer. Here is MEASURED data from an audio file — use these actual numbers to give specific mixing advice.

FILE ANALYSIS:
Filename: ${analysis.filename}
Duration: ${analysis.duration} | Sample rate: ${analysis.sampleRate} | Channels: ${analysis.channels}
Stereo width: ${analysis.stereoWidth}
Peak level: ${analysis.peakDb} | RMS loudness: ${analysis.rmsDb} | Dynamic range: ${analysis.dynRange}
Clipping: ${analysis.clipping}

FREQUENCY CONTENT (relative energy — 100% = dominant band):
${bandStr}

Instrument type: ${instrumentType}
Producer notes: ${extraDesc || 'None'}

Based on these actual measurements give:
- Specific EQ moves referencing the band data (Hz values, dB amounts, Q)
- Compression advice based on the peak/RMS/dynamic range numbers
- Address any clipping if detected
- Stereo treatment if width is an issue
- 2-3 specific plugins (free first, then paid)
Reference the actual numbers in your advice.`
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
const buildPrompt = ({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis }) => {
  const CHORD_LIST  = 'C Cm D Dm E Em F Fm G Gm A Am Bb Bbm B Bm F#m C#m Ab Eb'
  const MIDI_SUFFIX = `\n\nAt the very end on its own line output EXACTLY:\nMIDI: Em-G-D-A BPM: 140\nOnly use: ${CHORD_LIST}`

  const beginnerBlock = beginnerMode ? `

---
**BEGINNER EXPLAINER** (add at the very end):
In plain English: what this chord progression means (e.g. "Em = E minor = dark, moody"), how to find these notes on a keyboard, what a "${chordType}" sounds like in simple terms, what the BPM feels like physically, and one tip for placing these chords in FL Studio.` : ''

  // ── Melody / bass overrides for Start From Nothing ────
  if (mode === 'start' && midiType === 'melody') {
    return `You are a music production assistant. Generate a melodic idea for a ${input} track.
Give: key/scale, mood, BPM range, description of the melody character, how a beginner can use it.
At the very end on its own line output EXACTLY (8-12 notes, format E4 G4 A4 etc.):
MELODY: E4-G4-A4-G4-E4-D4-C4-D4 BPM: 130${beginnerBlock}`
  }

  if (mode === 'start' && midiType === 'bass') {
    return `You are a music production assistant. Generate a bassline idea for a ${input} track.
Give: key/scale, BPM, bassline character (rolling sub, punchy stabs, etc.), how to use it.
At the very end on its own line output EXACTLY (8 notes, bass register):
BASS: E2-E2-G2-A2-E2-G2-A2-C3 BPM: 130${beginnerBlock}`
  }

  if (mode === 'start') return `You are a music producer assistant with deep knowledge of electronic music.
A producer is starting from scratch. Give them:
- Suggested BPM range
- Key/scale recommendation
- A chord progression suited for a **${chordType}** sound
- Song structure breakdown
- 2-3 reference tracks
- One unique production element to stand out
Format with clear headers and **bold** key info.
Their vibe: ${input}${MIDI_SUFFIX}${beginnerBlock}`

  if (mode === 'stuck') return `You are a music producer assistant. A producer is stuck on something they've started.
Give 3 specific directions, each with: what to add next, energy arc, production technique.
Be direct. What they have: ${input}${MIDI_SUFFIX}`

  if (mode === 'lyrics') return `You are helping a music producer find their lyrical voice for UK electronic music.
DO NOT write full lyrics — generate raw material to SPARK their own writing:
- 3-4 raw themes/angles
- Vivid imagery and metaphors
- Emotional tensions to write from
- 5-8 title/hook fragment seeds (phrases, not full hooks)
- 1-2 artists' lyrical approaches to reference
Keep it raw, not cheesy. Their concept: ${input}`

  if (mode === 'sounds') return `You are a music producer assistant helping find new sounds.
Suggest: 5 specific platforms beyond Splice with search terms, 3 free sample packs or artists to look up, 2 creative flipping techniques.
Name actual platforms, packs, artists. Their situation: ${input}`

  if (mode === 'mix') return `You are a professional mixing engineer specialising in electronic music (UK garage, house, techno, speed garage).
Give extremely specific mixing advice:
- Exact EQ: frequency, dB, Q
- Compression: attack / release / ratio / threshold
- Sidechain suggestions
- Specific plugins (free first, then paid)
- What to listen for after each change
Their problem: ${input}`

  if (mode === 'design') {
    const synthNote = selectedSynth
      ? `The producer uses **${selectedSynth}**. Give the patch guide using that synth's exact parameter names.`
      : 'Give the patch guide for Serum/Vital.'
    return `You are a sound design expert for electronic music.
${synthNote}
Give:
- Synthesis approach (wavetable / subtractive / FM / etc.)
- Step-by-step patch guide with exact parameter values (cutoff Hz, resonance %, envelope ms, LFO rate)
- FX chain with specific settings (reverb size, delay ms, distortion type + drive %)
- 2 tips to make it uniquely theirs
Note: if they reference a track timestamp, I can't access audio — but I'll recreate the artist's known signature sound.
Their request: ${input}`
  }

  if (mode === 'generate') return `You are a music producer and AI music generation expert.
Create a full track brief and AI generation prompts for: ${input}

Output these 4 sections with clear headers:

## Track Brief
BPM, key, chord progression, main sounds/instruments, song structure (bars), energy arc.

## Suno Prompt
A single paragraph under 200 characters optimised for Suno AI. Genre, mood, tempo, key sounds. No line breaks.

## Udio Prompt
More detailed version under 300 characters for Udio. Can include more musical detail.

## Stems to Extract
Once they have the generated audio, which stems to separate (drums, bass, synths, etc.) and what to do with each in their DAW.

${MIDI_SUFFIX}`

  if (mode === 'sample') {
    if (sampleAnalysis) {
      return analysisToPrompt(sampleAnalysis, sampleInstrument, sampleDesc)
    }
    return `You are a professional mixing engineer. Give specific processing advice for this sample.
- EQ: exact Hz, dB, Q
- Compression: threshold, ratio, attack, release
- FX with specific settings
- Plugins (free first, then paid)
Instrument: ${sampleInstrument}
Description: ${sampleDesc}`
  }

  return input
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null)
  const [input, setInput] = useState('')
  const [chordType, setChordType] = useState('Pad')
  const [midiType, setMidiType] = useState('chord')
  const [beginnerMode, setBeginnerMode] = useState(false)
  const [selectedSynth, setSelectedSynth] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Thinking...')
  const [midiData, setMidiData] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

  // Follow-up / conversation
  const [conversationHistory, setConversationHistory] = useState([])
  const [followUpInput, setFollowUpInput] = useState('')

  // Sample analysis
  const [sampleFile, setSampleFile] = useState(null)
  const [sampleAnalysis, setSampleAnalysis] = useState(null)
  const [analysingAudio, setAnalysingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [sampleInstrument, setSampleInstrument] = useState('Kick')
  const [sampleDesc, setSampleDesc] = useState('')
  const fileInputRef = useRef(null)
  const loadingTimerRef = useRef(null)

  const [chordHistory, setChordHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chordHistory') || '[]') } catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('chordHistory', JSON.stringify(chordHistory))
  }, [chordHistory])

  // ── Rotate loading messages ──
  useEffect(() => {
    if (loading) {
      const msgs = LOADING_MSGS[mode] || ['Thinking...']
      let i = 0
      setLoadingMsg(msgs[0])
      loadingTimerRef.current = setInterval(() => {
        i = (i + 1) % msgs.length
        setLoadingMsg(msgs[i])
      }, 2000)
    } else {
      clearInterval(loadingTimerRef.current)
    }
    return () => clearInterval(loadingTimerRef.current)
  }, [loading, mode])

  // ── Handle file selection ──
  const handleFileSelect = async (file) => {
    if (!file) return
    setSampleFile(file)
    setSampleAnalysis(null)
    setAudioError('')
    setAnalysingAudio(true)
    try {
      const analysis = await analyzeAudioFile(file)
      setSampleAnalysis(analysis)
    } catch (err) {
      setAudioError(err.message)
    } finally {
      setAnalysingAudio(false)
    }
  }

  const midiTypeIcon = { chord: '🎹', melody: '🎵', bass: '🔉' }

  // ── Core generation (shared by initial + follow-up) ──
  const runGeneration = async (messages) => {
    setLoading(true)
    setResult('')
    setMidiData(null)
    setCopied(false)
    let accumulated = ''
    try {
      await callAI(messages, (chunk) => {
        accumulated += chunk
        setResult(accumulated)
      })
      const parsed  = parseMidiLine(accumulated)
      const cleaned = cleanResult(accumulated)
      setResult(cleaned)
      if (parsed) {
        const uri = parsed.type === 'chord'
          ? generateChordMidi(parsed.notes, parsed.bpm)
          : generateNoteMidi(parsed.notes, parsed.bpm)
        setMidiData({ ...parsed, uri })
        setChordHistory(prev => [{
          id: Date.now(),
          type: parsed.type,
          progression: parsed.notes.join(' → '),
          bpm: parsed.bpm,
          chordType: parsed.type === 'chord' ? chordType : parsed.type,
          label: (input || mode).substring(0, 45),
          timestamp: new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }),
          response: cleaned,
        }, ...prev].slice(0, 100))
      }
      return cleaned
    } catch (err) {
      const msg = 'Error: ' + err.message
      setResult(msg)
      return msg
    } finally {
      setLoading(false)
    }
  }

  // ── Initial generate ──
  const handleGenerate = async () => {
    if (!mode) return
    const prompt   = buildPrompt({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis })
    const messages = [{ role: 'user', content: prompt }]
    const response = await runGeneration(messages)
    setConversationHistory([
      { role: 'user', content: prompt },
      { role: 'assistant', content: response },
    ])
  }

  // ── Follow-up (keeps conversation context) ──
  const handleFollowUp = async (text) => {
    if (!text.trim()) return
    setFollowUpInput('')
    const newHistory = [...conversationHistory, { role: 'user', content: text }]
    const response   = await runGeneration(newHistory)
    setConversationHistory([...newHistory, { role: 'assistant', content: response }])
  }

  // ── Copy result to clipboard ──
  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const canGenerate = mode === 'sample'
    ? (sampleAnalysis != null || sampleDesc.trim().length > 0)
    : input.trim().length > 0

  const resetMode = (id) => {
    setMode(id); setInput(''); setResult(''); setMidiData(null)
    setSampleFile(null); setSampleAnalysis(null); setAudioError('')
    setConversationHistory([]); setFollowUpInput('')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Producer's Toolkit</h1>
            <p className="text-gray-400 mt-1">UK Garage · House · Techno · Speed Garage</p>
          </div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              showHistory ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                         : 'border-gray-700 bg-gray-900 hover:border-gray-500 text-gray-300'
            }`}
          >
            📋 History
            {chordHistory.length > 0 && (
              <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">{chordHistory.length}</span>
            )}
          </button>
        </div>

        {/* ── History panel ── */}
        {showHistory && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-200">Generation History</h2>
              {chordHistory.length > 0 && (
                <button onClick={() => setChordHistory([])} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
              )}
            </div>
            {chordHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No history yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {chordHistory.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setResult(entry.response)
                      setConversationHistory([
                        { role: 'user', content: `History restore: ${entry.label}` },
                        { role: 'assistant', content: entry.response },
                      ])
                      setShowHistory(false)
                    }}
                    className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-purple-300 font-mono font-semibold text-sm">
                        {midiTypeIcon[entry.type] || '🎹'} {entry.progression}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{entry.bpm} BPM</span>
                        <span className="bg-purple-900/60 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-700">{entry.chordType}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{entry.label} · {entry.timestamp}</div>
                    <div className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to restore response →</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Mode grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => resetMode(m.id)}
              className={`p-4 rounded-xl text-left border transition-all ${
                mode === m.id ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-800 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="font-semibold mb-0.5">{m.label}</div>
              <div className="text-sm text-gray-400">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Input panel ── */}
        {mode && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">

            {/* Start From Nothing — MIDI type + chord type + beginner toggle */}
            {mode === 'start' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">What to generate</label>
                  <div className="flex gap-2">
                    {MIDI_TYPES.map(t => (
                      <button key={t.id} onClick={() => setMidiType(t.id)}
                        className={`flex-1 p-2.5 rounded-lg text-sm border transition-all ${
                          midiType === t.id ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                           : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs opacity-60">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {midiType === 'chord' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Chord Sound Type</label>
                    <div className="flex flex-wrap gap-2">
                      {CHORD_TYPES.map(t => (
                        <button key={t} onClick={() => setChordType(t)}
                          className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                            chordType === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                           : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                          }`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={() => setBeginnerMode(b => !b)}
                    className={`relative w-10 h-5 rounded-full border transition-colors shrink-0 ${
                      beginnerMode ? 'bg-purple-600 border-purple-500' : 'bg-gray-700 border-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${beginnerMode ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-gray-300">
                    🔰 Beginner Mode
                    <span className="text-gray-500 text-xs ml-1.5">explains chords, sounds & BPM in plain English</span>
                  </span>
                </div>
              </>
            )}

            {/* I Have Something — chord type */}
            {mode === 'stuck' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Chord Sound Type (for MIDI)</label>
                <div className="flex flex-wrap gap-2">
                  {CHORD_TYPES.map(t => (
                    <button key={t} onClick={() => setChordType(t)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                        chordType === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                       : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Sound Design — synth selector */}
            {mode === 'design' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Your Synth</label>
                <div className="flex flex-wrap gap-2">
                  {SYNTHS.map(s => (
                    <button key={s} onClick={() => setSelectedSynth(selectedSynth === s ? '' : s)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                        selectedSynth === s ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                           : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Analyse Sample — file upload + real analysis */}
            {mode === 'sample' ? (
              <div className="space-y-4">
                {/* Instrument type */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Instrument / Sound Type</label>
                  <div className="flex flex-wrap gap-2">
                    {['Kick','Snare/Clap','Hi-hat','Bass','Synth/Lead','Pad','Vocal Chop','Full Loop','FX/Riser'].map(t => (
                      <button key={t} onClick={() => setSampleInstrument(t)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          sampleInstrument === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                                 : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Upload Sample (MP3 or WAV)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={e => handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl p-6 text-center transition-colors"
                  >
                    {sampleFile ? (
                      <div>
                        <div className="text-purple-300 font-medium">{sampleFile.name}</div>
                        <div className="text-gray-500 text-xs mt-1">Click to change file</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl mb-2">🎵</div>
                        <div className="text-gray-400 text-sm">Click to upload your sample</div>
                        <div className="text-gray-600 text-xs mt-1">MP3, WAV, AIFF, etc.</div>
                      </div>
                    )}
                  </button>
                </div>

                {/* Analysis in progress */}
                {analysingAudio && (
                  <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Analysing audio…
                  </div>
                )}

                {/* Audio error */}
                {audioError && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{audioError}</div>
                )}

                {/* Analysis results */}
                {sampleAnalysis && !analysingAudio && (
                  <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-3">
                    <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Analysis Results</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div><span className="text-gray-500">Duration</span> <span className="text-gray-200 float-right">{sampleAnalysis.duration}</span></div>
                      <div><span className="text-gray-500">Sample rate</span> <span className="text-gray-200 float-right">{sampleAnalysis.sampleRate}</span></div>
                      <div><span className="text-gray-500">Channels</span> <span className="text-gray-200 float-right">{sampleAnalysis.channels}</span></div>
                      <div><span className="text-gray-500">Stereo width</span> <span className="text-gray-200 float-right">{sampleAnalysis.stereoWidth}</span></div>
                      <div><span className="text-gray-500">Peak</span> <span className="text-gray-200 float-right">{sampleAnalysis.peakDb}</span></div>
                      <div><span className="text-gray-500">RMS</span> <span className="text-gray-200 float-right">{sampleAnalysis.rmsDb}</span></div>
                      <div className="col-span-2"><span className="text-gray-500">Clipping</span> <span className={`float-right ${sampleAnalysis.clipping.startsWith('⚠️') ? 'text-red-400' : 'text-green-400'}`}>{sampleAnalysis.clipping}</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Frequency content</div>
                      <div className="space-y-1.5">
                        {sampleAnalysis.bands.map(b => (
                          <div key={b.name} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 w-36 shrink-0">{b.name}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-purple-500 h-1.5 rounded-full transition-all"
                                style={{ width: b.pct + '%' }}
                              />
                            </div>
                            <span className="text-gray-400 w-8 text-right">{b.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional description */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Additional notes <span className="text-gray-600">(optional — what you hear, the problem, context)</span>
                  </label>
                  <textarea
                    value={sampleDesc}
                    onChange={e => setSampleDesc(e.target.value)}
                    placeholder="e.g. sounds muddy, gets buried in the mix, using FL Studio…"
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none text-sm"
                  />
                </div>
              </div>
            ) : (
              // All other modes — text input
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  mode === 'start'    ? 'e.g. Dark UK garage, late night feel, 130 BPM range…' :
                  mode === 'stuck'    ? "e.g. I have a 4-bar loop with an Em pad and rolling bassline, don't know what to add…" :
                  mode === 'lyrics'   ? 'e.g. Driving through London at 3am, paranoid energy…' :
                  mode === 'sounds'   ? 'e.g. I mainly use Splice but keep using the same sounds. I make speed garage…' :
                  mode === 'mix'      ? 'e.g. Kick gets lost under the bassline in a speed garage track. FL Studio, Kick2, Serum…' :
                  mode === 'design'   ? 'e.g. I want a synth like John Summit - Where You Are. Warm, slightly distorted house lead.' :
                  mode === 'generate' ? 'e.g. Dark UK garage track, 130 BPM, late night paranoid energy, gritty sub bass…' :
                  'Tell me more…'
                }
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            )}

            {/* Generate Track — helper note */}
            {mode === 'generate' && (
              <p className="text-xs text-gray-500">
                💡 This generates a Suno/Udio prompt you paste into those tools for full AI audio + stem export. Suno has a free tier at <span className="text-purple-400">suno.com</span>.
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all"
            >
              {loading ? loadingMsg : 'Generate'}
            </button>
          </div>
        )}

        {/* ── MIDI download ── */}
        {midiData && (
          <div className="mb-4 p-4 bg-purple-900/30 border border-purple-500/30 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-purple-300">{midiTypeIcon[midiData.type]} MIDI Ready</div>
              <div className="text-sm text-gray-400 mt-0.5">
                {midiData.notes.join(' → ')} · {midiData.bpm} BPM{midiData.type === 'chord' ? ` · ${chordType}` : ''}
              </div>
            </div>
            <a
              href={midiData.uri}
              download={`${midiData.type}_${midiData.notes.join('-')}_${midiData.bpm}bpm.mid`}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-sm transition-all"
            >
              Download MIDI
            </a>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="space-y-3">
            {/* Result box with copy button */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 prose prose-invert max-w-none relative">
              <button
                onClick={handleCopy}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-all border border-gray-700"
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>

            {/* Follow-up suggestions */}
            {!loading && mode && FOLLOW_UPS[mode] && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 px-1">Follow up:</p>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UPS[mode].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleFollowUp(suggestion)}
                      className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 rounded-lg text-sm text-gray-300 hover:text-white transition-all text-left"
                    >
                      {suggestion} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom follow-up input */}
            {!loading && conversationHistory.length > 0 && (
              <div className="flex gap-2">
                <input
                  value={followUpInput}
                  onChange={e => setFollowUpInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFollowUp(followUpInput)}
                  placeholder="Ask a follow-up... change anything, go deeper, modify the vibe"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => handleFollowUp(followUpInput)}
                  disabled={!followUpInput.trim()}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-all"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
