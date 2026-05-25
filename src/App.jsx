import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import MidiWriter from 'midi-writer-js'
import './App.css'

// =============================================================================
// APP.JSX — PRODUCER'S TOOLKIT
// =============================================================================
//
// FILE STRUCTURE (top to bottom):
//
//  CONSTANTS & CONFIG          line ~7    — LOADING_MSGS, FOLLOW_UPS, MODES, CHORD_VOICINGS etc.
//  UTILITY FUNCTIONS           line ~48   — callAI (streaming API wrapper)
//  MIDI GENERATION             line ~129  — generateChordMidi, generateNoteMidi
//  MIDI PARSING                line ~149  — parseMidiLine, parseAllMidi, cleanResult
//  WEB AUDIO ANALYSIS          line ~217  — analyzeAudioFile (frequency/peak/RMS)
//  STEREO FIELD ANALYSIS       line ~314  — analyzeStereoField + buildStereoPrompt + parseStereoField
//  STEREO FIELD COMPONENT      line ~419  — StereoFieldPanel (SVG bird's-eye view)
//  COMPLETION ENGINE           line ~521  — constants, prompt builders, parsers
//  PROMPT BUILDER              line ~650  — buildPrompt() — one big switch for all modes
//  GUIDE CONTENT               line ~1066 — GUIDE[] — the ? modal content
//
//  APP COMPONENT               line ~1172 — export default function App()
//    STATE                     line ~1173 — all useState/useRef declarations
//    EFFECTS                   line ~1247 — scroll, loading messages, localStorage sync
//    FILE HANDLERS             line ~1271 — handleFileSelect, handleStereoFileSelect
//    CORE GENERATION           line ~1306 — runGeneration, handleGenerate, handleFollowUp
//    COMPLETION HANDLERS       line ~1480 — handleBeginCompletion → handleMarkFinished
//    JSX / RENDER              line ~1638 — return(...)
//      HEADER                             — title, ? button, History button
//      HISTORY PANEL                      — chord history drawer
//      HOME SCREEN (mode grid)            — all tool cards (only shown when no mode active)
//      ACTIVE MODE HEADER                 — ← All tools + mode chip
//      COMPLETION ENGINE UI               — 7-stage flow (separate from standard input)
//      STANDARD INPUT PANEL               — textarea / file upload / mode controls + Generate
//      RESULT + FOLLOW-UPS                — streamed markdown response + suggestion chips
//      MIDI CARDS                         — download buttons for chord/melody/bass MIDI
//      STEREO FIELD VISUALIZATION         — side-by-side SVG panels + comparison table
//      DJ ROADMAP                         — horizontal stage cards
//      GUIDE MODAL                        — fullscreen overlay
//
// =============================================================================

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
  daw:      ['Thinking...', 'Checking your budget...', 'Building your setup...', 'Picking the right plugins...'],
  transition:['Thinking...', 'Mapping the differences...', 'Comparing workflows...', 'Building your guide...'],  
  dj:       ['Thinking...', 'Building your roadmap...', 'Checking the gear...', 'Mapping the journey...'],
  djset:    ['Thinking...', 'Planning the set...', 'Mapping the energy arc...', 'Sequencing the tracks...'],
  visuals:  ['Thinking...', 'Scanning the tools...', 'Finding the aesthetic...', 'Building your stack...'],
  vocals:   ['Thinking...', 'Building the chain...', 'Setting the gain staging...', 'Tuning the processing...'],
  master:   ['Thinking...', 'Checking the chain...', 'Analysing the headroom...', 'Preparing the master...'],
  release:  ['Thinking...', 'Building the timeline...', 'Finding the right playlists...', 'Mapping the rollout...'],
  stereo:   ['Thinking...', 'Measuring the field...', 'Plotting the spectrum...', 'Mapping instrument positions...'],
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
  daw:      ['What free plugins should I start with?', 'How do I set up my audio interface?', 'What are the best YouTube channels to learn from?', 'How do I organize my project files?'],
  transition:['Go deeper on the arrangment view differences', 'How does Ableton handle samples vs FL?', 'What are the best Ableton-specific techniques?', 'How long will the transition realistically take?'],
  dj:       ['What budget controller can I start with?', 'How do I mix in key?', 'How do I learn to beatmatch?', 'What\'s the best way to practice DJing?', 'What are the best YouTube channels for DJs?', 'How do I transition from producing to DJing my own music?'],
  djset:    ['Make the energy arc more aggressive', 'Give me a safer version for a mixed crowd', 'What transitions work best between these genres?', 'How do I handle requests without derailing the set?'],
  visuals:  ['Which of these work best for live performance?', 'What\'s the easiest to learn from scratch?', 'Give me free alternatives only', 'How do I sync visuals to my music?'],
  vocals:   ['Give me free plugin alternatives for this chain', 'How do I set up the parallel compression properly?', 'How do I get more width without it sounding fake?', 'How do I make the vocal sit better in a busy mix?'],
  master:   ['What LUFS should I target for Spotify/streaming?', 'How do I get more loudness without squashing the dynamics?', 'Give me a free alternative mastering chain', 'How do I check my master on different systems?'],
  release:  ['Write me a Spotify editorial pitch for this track', 'Which UK garage blogs and playlists should I submit to?', 'Give me 7 days of Instagram content ideas for this release', 'How do I get on Spotify\'s algorithmic playlists?'],
  stereo:   ['How do I widen my synths without losing mono compatibility?', 'What causes the sub bass to sound off-center?', 'How do I tighten the stereo field for club systems?', 'What plugins can I use for mid/side processing?'],
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
    const stream = client.messages.stream({ model: 'claude-haiku-4-5-20251001', max_tokens: 2500, messages })
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
  { id: 'lyrics',   label: '✍️ Lyric Concepts',     desc: 'Raw themes, not cheesy AI' },
  { id: 'sounds',   label: '🎧 Sound Discovery',    desc: 'Beyond Splice'             },
  { id: 'mix',      label: '🎚️ Mix Advice',         desc: 'Surgical EQ & plugin tips' },
  { id: 'design',   label: '🔊 Sound Design',       desc: 'Recreate any sound'        },
  { id: 'generate', label: '🎵 Generate Track',     desc: 'Suno/Udio prompt + brief'  },
  { id: 'sample',   label: '🎙️ Analyze Sample',     desc: 'Upload audio for real analysis' },
  { id: 'daw',       label: '🖥️ DAW & Learning',     desc: 'Setup, gear & switching DAWs' },
  { id: 'vocals',    label: '🎤 Vocal Chain',         desc: 'Pro chain from a working producer' },
  { id: 'master',   label: '🎛️ Master Chain',        desc: 'Full mastering chain breakdown' },
  { id: 'stereo',   label: '🌐 Stereo Analyzer',     desc: 'Map your mix\'s 3D stereo field'  },
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
    track.addEvent(new MidiWriter.NoteEvent({ pitch: [note], duration: '4', velocity: 80 }))
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

// Parse all 3 MIDI lines + instruments + mixer from a full-track response
// No ^ anchor — AI may indent or prefix lines, so we match anywhere in the text
const parseAllMidi = (text) => {
  const result = {}
  const chordMatch  = text.match(/MIDI:\s*([\w#b]+(?:-[\w#b]+)*)\s+BPM:\s*(\d+)/i)
  if (chordMatch)  result.chord  = { notes: chordMatch[1].split('-'),  bpm: parseInt(chordMatch[2]) }
  const melodyMatch = text.match(/MELODY:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (melodyMatch) result.melody = { notes: melodyMatch[1].split('-'), bpm: parseInt(melodyMatch[2]) }
  const bassMatch   = text.match(/BASS:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (bassMatch)   result.bass   = { notes: bassMatch[1].split('-'),   bpm: parseInt(bassMatch[2]) }
  const instrMatch  = text.match(/INSTRUMENTS:\s*([^\n]+)/i)
  if (instrMatch) {
    result.instruments = {}
    instrMatch[1].split('|').forEach(p => {
      const idx = p.indexOf(':')
      if (idx > -1) result.instruments[p.slice(0, idx).trim().toLowerCase()] = p.slice(idx + 1).trim()
    })
  }
  const mixerMatch = text.match(/MIXER:\s*([^\n]+)/i)
  if (mixerMatch) {
    result.mixer = mixerMatch[1].split('|').map((ch, i) => {
      const idx = ch.indexOf(':')
      return idx > -1
        ? { ch: i + 1, label: ch.slice(0, idx).trim(), detail: ch.slice(idx + 1).trim() }
        : { ch: i + 1, label: ch.trim(), detail: '' }
    })
  }
  return Object.keys(result).length > 0 ? result : null
}

const cleanResult = (text) =>
  text
    .replace(/^MIDI:.*BPM:\s*\d+.*$/gmi, '')
    .replace(/^MELODY:.*BPM:\s*\d+.*$/gmi, '')
    .replace(/^BASS:.*BPM:\s*\d+.*$/gmi, '')
    .replace(/^INSTRUMENTS:[^\n]*/gmi, '')
    .replace(/^MIXER:[^\n]*/gmi, '')
    .replace(/^STAGE\[\d+\]:[^\n]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const parseDJRoadmap = (text) => {
  const stages = []
  const regex = /STAGE\[(\d+)\]:\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(.+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    stages.push({
      num: parseInt(match[1]),
      title: match[2].trim(),
      timeframe: match[3].trim(),
      focus: match[4].trim(),
      gear: match[5].trim(),
    })
  }
  return stages.length >= 2 ? stages : null
}

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

// ─── Stereo field analysis ────────────────────────────────────────────────────
const analyzeStereoField = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  let audioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    await audioCtx.close()
    throw new Error('Could not decode audio — try MP3 or WAV.')
  }
  const ch0    = audioBuffer.getChannelData(0)
  const ch1    = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0
  const sr     = audioBuffer.sampleRate
  const isMono = audioBuffer.numberOfChannels === 1

  const winSize = Math.min(8192, ch0.length)
  const mid     = Math.floor((ch0.length - winSize) / 2)
  const applyHann = (seg) => {
    const w = new Float32Array(winSize)
    for (let i = 0; i < winSize; i++) w[i] = seg[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (winSize - 1)))
    return w
  }
  const winL = applyHann(ch0.slice(mid, mid + winSize))
  const winR = applyHann(ch1.slice(mid, mid + winSize))

  const goertzel = (samples, freq) => {
    const N = samples.length
    const k = Math.round(N * freq / sr)
    if (k <= 0 || k >= N / 2) return 0
    const coeff = 2 * Math.cos(2 * Math.PI * k / N)
    let s1 = 0, s2 = 0
    for (let i = 0; i < N; i++) { const s = samples[i] + coeff * s1 - s2; s2 = s1; s1 = s }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - s1 * s2 * coeff))
  }

  const STEREO_BANDS = [
    { name: 'Sub Bass',   freq: 50    },
    { name: 'Kick/Bass',  freq: 120   },
    { name: 'Low Mids',   freq: 350   },
    { name: 'Mids',       freq: 1000  },
    { name: 'Upper Mids', freq: 3500  },
    { name: 'Presence',   freq: 9000  },
    { name: 'Air',        freq: 16000 },
  ]
  const bandData = STEREO_BANDS.map(band => {
    const eL    = goertzel(winL, band.freq)
    const eR    = goertzel(winR, band.freq)
    const total = eL + eR
    const pan   = (total > 0.0001 && !isMono) ? Math.round(((eR - eL) / total) * 100) : 0
    return { name: band.name, freq: band.freq, pan, eL, eR, energy: total / 2 }
  })

  const limit = Math.min(ch0.length, 80000)
  let sumLR = 0, sumL2 = 0, sumR2 = 0
  for (let i = 0; i < limit; i++) { sumLR += ch0[i]*ch1[i]; sumL2 += ch0[i]**2; sumR2 += ch1[i]**2 }
  const corr  = sumLR / Math.sqrt(Math.max(sumL2 * sumR2, 1e-10))
  const overallWidth = isMono ? 0 : Math.round((1 - Math.abs(corr)) * 100)

  await audioCtx.close()
  return { filename: file.name, duration: audioBuffer.duration.toFixed(1), isMono, overallWidth, bandData }
}

const buildStereoPrompt = (analysis, genre) => {
  const bandStr = analysis.bandData.map(b =>
    `${b.name}: pan=${b.pan > 0 ? '+' : ''}${b.pan} (${b.pan < -25 ? 'LEFT' : b.pan > 25 ? 'RIGHT' : 'CENTER'}), energy=${b.energy.toFixed(4)}`
  ).join('\n')
  return `You are a professional mixing engineer analyzing a track's stereo field.

MEASURED DATA:
File: ${analysis.filename} | Duration: ${analysis.duration}s | ${analysis.isMono ? 'MONO' : 'Stereo'} | Overall width: ${analysis.overallWidth}%
Per-band positions (pan: -100=hard left, 0=center, +100=hard right):
${bandStr}
Genre: ${genre || 'electronic music (UK garage / house / techno)'}

Map each frequency band to the most likely instrument for this genre. Output ONLY these lines — no headers, no extra text:
ACTUAL: [instrument name]|[pan -100 to 100]|[depth 0-100 where 0=front/dry 100=back/wet]|[size S/M/L]
(one ACTUAL line per band, 7 total)
IDEAL: [instrument name]|[pan]|[depth]|[size]
(one IDEAL line per band, 7 total — same instruments but at optimal positions)
FEEDBACK: [One actionable sentence about the most important stereo field fix]

Band → instrument mapping for ${genre || 'electronic music'}:
Sub Bass (50Hz) → "808 / Sub" — Kick/Bass (120Hz) → "Kick" or "Bass" — Low Mids (350Hz) → "Pads/Body" — Mids (1kHz) → "Synth Lead" or "Vocals" — Upper Mids (3.5kHz) → "Hi-Hats/Snare" — Presence (9kHz) → "Cymbals/Tops" — Air (16kHz) → "Room/Air"
Output ONLY the 7 ACTUAL lines, 7 IDEAL lines, and 1 FEEDBACK line.`
}

const parseStereoField = (text) => {
  const actual = [], ideal = []
  let feedback = ''
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('ACTUAL:')) {
      const p = t.slice(7).trim().split('|')
      if (p.length >= 4) actual.push({ name: p[0].trim(), pan: parseInt(p[1]) || 0, depth: parseInt(p[2]) || 50, size: (p[3].trim()[0] || 'M').toUpperCase() })
    } else if (t.startsWith('IDEAL:')) {
      const p = t.slice(6).trim().split('|')
      if (p.length >= 4) ideal.push({ name: p[0].trim(), pan: parseInt(p[1]) || 0, depth: parseInt(p[2]) || 50, size: (p[3].trim()[0] || 'M').toUpperCase() })
    } else if (t.startsWith('FEEDBACK:')) {
      feedback = t.slice(9).trim()
    }
  }
  return (actual.length > 0 || ideal.length > 0) ? { actual, ideal, feedback } : null
}

// ─── Stereo field panel component ────────────────────────────────────────────
const STEREO_COLORS = ['#a78bfa','#60a5fa','#34d399','#f97316','#f472b6','#fb923c','#4ade80','#c084fc','#38bdf8']

const StereoFieldPanel = ({ instruments, title, accent = 'purple' }) => {
  const panToX   = (pan)   => 22 + ((Math.max(-100, Math.min(100, pan)) + 100) / 200) * 196
  const depthToY = (depth) => 195 - (Math.max(0, Math.min(100, depth)) / 100) * 172
  const borderCls = accent === 'blue' ? 'border-blue-500/40' : 'border-purple-500/40'
  const titleCls  = accent === 'blue' ? 'text-blue-300' : 'text-purple-300'
  const gradId    = `fg_${accent}`
  return (
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-bold mb-2 uppercase tracking-wider ${titleCls}`}>{title}</div>
      <svg viewBox="0 0 240 220" className={`w-full rounded-xl border ${borderCls}`} style={{ background: '#070710' }}>
        <defs>
          <radialGradient id={gradId} cx="50%" cy="58%" r="55%">
            <stop offset="0%"   stopColor={accent === 'blue' ? '#0f1e35' : '#130f2a'} stopOpacity="1"/>
            <stop offset="100%" stopColor="#050508" stopOpacity="1"/>
          </radialGradient>
        </defs>
        <rect width="240" height="220" fill={`url(#${gradId})`} rx="8"/>

        {/* Oval representing stereo space */}
        <ellipse cx="120" cy="165" rx="100" ry="42" fill="none" stroke="#1f2937" strokeWidth="1.5" strokeDasharray="5,3"/>
        <ellipse cx="120" cy="130" rx="100" ry="90" fill="none" stroke="#111827" strokeWidth="1" strokeDasharray="3,4"/>

        {/* Center crosshairs */}
        <line x1="120" y1="8"  x2="120" y2="212" stroke="#1f2937" strokeWidth="1"/>
        <line x1="8"   y1="160" x2="232" y2="160" stroke="#1f2937" strokeWidth="1"/>

        {/* Axis labels */}
        <text x="12"  y="215" fill="#374151" fontSize="8" fontFamily="monospace">L</text>
        <text x="224" y="215" fill="#374151" fontSize="8" fontFamily="monospace">R</text>
        <text x="115" y="215" fill="#374151" fontSize="8" fontFamily="monospace">C</text>
        <text x="10"  y="14"  fill="#374151" fontSize="7" fontFamily="monospace">BACK</text>
        <text x="8"   y="158" fill="#374151" fontSize="7" fontFamily="monospace">FRONT</text>

        {/* Instruments */}
        {instruments.map((inst, i) => {
          const x   = panToX(inst.pan)
          const y   = depthToY(inst.depth)
          const r   = inst.size === 'L' ? 11 : inst.size === 'S' ? 5 : 8
          const col = STEREO_COLORS[i % STEREO_COLORS.length]
          const lbl = inst.name.length > 10 ? inst.name.slice(0, 9) + '…' : inst.name
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r + 5} fill={col} opacity="0.07"/>
              <circle cx={x} cy={y} r={r}     fill={col} opacity="0.22"/>
              <circle cx={x} cy={y} r={r / 2.2} fill={col} opacity="0.9"/>
              <text x={x} y={y - r - 3} fill={col} fontSize="7.5" fontFamily="ui-sans-serif,system-ui,sans-serif"
                textAnchor="middle" fontWeight="700">{lbl}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
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

// ─── MIDI-only prompt (second focused call) ──────────────────────────────────
// Separate from the main prompt so MIDI never gets cut off by a long text response
const buildMidiOnlyPrompt = (input, trackBrief) => {
  const CHORD_LIST = 'C Cm D Dm E Em F Fm G Gm A Am Bb Bbm B Bm F#m C#m Ab Eb'
  return `You are a music production assistant generating MIDI data. Output ONLY the following 5 lines — no explanations, no headers, no extra text before or after.

Track request: "${input}"
Track description: ${trackBrief.slice(0, 700)}

MIDI: [4 chords matching the key and mood] BPM: [bpm]
MELODY: [8 notes matching the key e.g. A4-C5-E5-D5-C5-A4-G4-A4] BPM: [bpm]
BASS: [8 bass-register notes e.g. A2-A2-F2-C3-A2-G2-F2-E2] BPM: [bpm]
INSTRUMENTS: Chords:[FL Studio synth or plugin]|Melody:[FL Studio synth or plugin]|Bass:[plugin or 808 type]|Drums:[drum machine or sample pack]
MIXER: Ch1:[name]|Ch2:[name]|Ch3:[name]|Ch4:[name]|Ch5:[name]

Rules: Chord list only: ${CHORD_LIST}. Note format: A4 C#3 Bb2 etc. Match the exact key and BPM from the track description. Output nothing except the 5 lines above.`
}

// ─── Completion Engine — constants ───────────────────────────────────────────
const COMPLETION_STAGES = ['Lock-In', 'Structure', 'Decisions', 'Feedback', 'Export']

// Stages of song Progress
const STAGE_PROGRESS = {
  sound_design: 25,
  composition: 50,
  mixing: 75,
  mastering: 100
}

const EXPORT_CHECKLIST = [
  'Master bus limiter is on',
  'Exported at 44.1kHz or 48kHz (not 96kHz)',
  'File named correctly (e.g. MAYVBLU_TrackName_Final.wav)',
  'Checked on phone speakers or AirPods',
  'Sent to at least one person for a listen',
]

// ─── Completion Engine — prompt builders ─────────────────────────────────────
const buildIdeaLockPrompt = (description, audioAnalysis) => {
  const hasDescription = description && description.trim().length > 0
  const descriptionBlock = hasDescription
    ? `Producer's description: "${description.trim()}"`
    : `Producer's description: (none provided — infer from audio measurements below)`
  const audioBlock = audioAnalysis
    ? `\nAUDIO MEASUREMENTS (extracted client-side — these are real numbers from the file, not the raw audio):
  Duration: ${audioAnalysis.duration} | Channels: ${audioAnalysis.channels} | Peak: ${audioAnalysis.peakDb} | Stereo width: ${audioAnalysis.stereoWidth} | Dominant frequency bands: ${audioAnalysis.bands.filter(b => b.pct > 40).map(b => b.name).join(', ') || 'mid-range'}`
    : `\nNo audio file uploaded.`
  return `You are a music production coach. A producer wants to commit to finishing a track. Use whatever information is available — description, audio measurements, or both — to write a commitment statement that locks them in.

${descriptionBlock}${audioBlock}

Even if the information is limited, make your best inference and commit to a direction. Do NOT ask for more details or explain what you can't do.

Output EXACTLY these lines (no extra text before or after):
COMMITMENT: [Bold, specific 2-sentence statement. Name the exact genre, energy, and key sonic elements. No generic phrases.]
BPM: [single number — best estimate or suggestion]
KEY: [musical key and scale, e.g. A minor, F# minor, C major]
VIBE: [exactly 3 words, e.g. dark paranoid rolling]
DIRECTION: [One short paragraph — what makes this worth finishing. Be direct and honest, not hype.]`
}

const buildStructurePrompt = (commitment, bpm, vibe) => {
  return `You are a music producer turning a loop into a complete arrangement skeleton.

Track: "${commitment}" | BPM: ${bpm} | Vibe: ${vibe}

Output EXACTLY this (no other text before or after):
STRUCTURE:
Intro: [bars] bars — [what happens here]
Build: [bars] bars — [what happens]
Drop: [bars] bars — [what happens]
Breakdown: [bars] bars — [what happens]
Drop 2: [bars] bars — [what happens]
Outro: [bars] bars — [what happens]
TOTAL: [total bars] bars ≈ [min:sec] at ${bpm} BPM

TIPS:
[3 specific FL Studio arrangement tips for this exact track — which elements to mute, filter, automate, or add in each section to create movement. Reference the BPM and vibe.]`
}

const buildForcedDecisionsPrompt = (commitment, structure, bpm, vibe) => {
  return `You are a music production coach helping a producer eliminate decision fatigue. Generate exactly 3 forced decisions. Each must be specific, concrete, and force a single choice.

Track: "${commitment}" | BPM: ${bpm} | Vibe: ${vibe}
Structure overview: ${structure.slice(0, 300)}

Output EXACTLY 3 blocks with this format (no intros, no outros, no extra text):

DECISION_1:
QUESTION: [Direct, specific question — e.g. "Which kick do you keep — the 808-punchy one or the clicky techno one?"]
OPTION_A: [Concrete specific option]
OPTION_B: [Different concrete option]
RECOMMENDED: [A or B — whichever serves this track better, with one short reason]

DECISION_2:
QUESTION: [Different area — e.g. about arrangement, a sound choice, or energy level]
OPTION_A: [Specific option]
OPTION_B: [Different option]
RECOMMENDED: [A or B — whichever serves this track better, with one short reason]

DECISION_3:
QUESTION: [Third area — transition, texture, or final element]
OPTION_A: [Specific option]
OPTION_B: [Different option]
RECOMMENDED: [A or B — whichever serves this track better, with one short reason]

Make every decision specific to this genre and BPM. No generic questions like "which direction do you prefer?"`
}

const buildFeedbackPrompt = (commitment, decisions, structure) => {
  const decisionsStr = decisions.length > 0
    ? decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : 'No decisions logged.'
  return `You are a professional producer giving critical feedback. Give EXACTLY 3 pieces — no more, no less.

Track: "${commitment}"
Structure: ${structure.slice(0, 250)}
Producer's decisions:
${decisionsStr}

Output ONLY:
FEEDBACK_1: [THE MOST CRITICAL FIX — one specific, actionable sentence. This has the biggest impact on whether the track is done.]
FEEDBACK_2: [SECOND MOST IMPORTANT — specific, different area from #1.]
FEEDBACK_3: [NICE-TO-HAVE — lower priority, worth doing if time allows, not blocking.]

No compliments. No padding. No "sounds great". Just the 3 fixes. Reference the actual structure and decisions.`
}

// ─── Completion Engine — parsers ──────────────────────────────────────────────
const parseIdeaLock = (text) => {
  const commitment = text.match(/COMMITMENT:\s*(.+?)(?=\nBPM:)/is)?.[1]?.trim()
  const bpm        = parseInt(text.match(/BPM:\s*(\d+)/i)?.[1] || '130')
  const key        = text.match(/KEY:\s*([^\n]+)/i)?.[1]?.trim() || 'A minor'
  const vibe       = text.match(/VIBE:\s*([^\n]+)/i)?.[1]?.trim() || ''
  const direction  = text.match(/DIRECTION:\s*([\s\S]+?)(?=\n[A-Z]+:|$)/i)?.[1]?.trim()
                  || text.match(/DIRECTION:\s*([\s\S]+?)$/i)?.[1]?.trim()
  return commitment ? { commitment, bpm, key, vibe, direction } : null
}

const parseStructure = (text) => {
  const structure = text.match(/STRUCTURE:\s*([\s\S]*?)(?=TIPS:|$)/i)?.[1]?.trim() || text.trim()
  const tips      = text.match(/TIPS:\s*([\s\S]*?)$/i)?.[1]?.trim() || ''
  return { structure, tips }
}

const parseForcedDecisions = (text) => {
  const decisions = []
  for (let i = 1; i <= 3; i++) {
    const endPattern = i < 3 ? `DECISION_${i + 1}:` : '$'
    const blockRe    = new RegExp(`DECISION_${i}:[\\s\\S]*?(?=${endPattern})`, 'i')
    const block      = text.match(blockRe)?.[0] || ''
    const question    = block.match(/QUESTION:\s*([^\n]+)/i)?.[1]?.trim()
    const optionA     = block.match(/OPTION_A:\s*([^\n]+)/i)?.[1]?.trim()
    const optionB     = block.match(/OPTION_B:\s*([^\n]+)/i)?.[1]?.trim()
    const recRaw      = block.match(/RECOMMENDED:\s*([^\n]+)/i)?.[1]?.trim() || ''
    const recommended = recRaw.toUpperCase().startsWith('B') ? 'B' : 'A'
    if (question && optionA && optionB) decisions.push({ question, optionA, optionB, recommended, recommendedReason: recRaw })
  }
  return decisions
}

const parseFeedback = (text) => [
  text.match(/FEEDBACK_1:\s*([^\n]+)/i)?.[1]?.trim(),
  text.match(/FEEDBACK_2:\s*([^\n]+)/i)?.[1]?.trim(),
  text.match(/FEEDBACK_3:\s*([^\n]+)/i)?.[1]?.trim(),
].filter(Boolean)

// ─── Prompt builder ───────────────────────────────────────────────────────────
const buildPrompt = ({ mode, input, chordType, midiType, beginnerMode, pedalNote, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis, dawMode, djSetEvent, djSetDuration, djSetEnergy }) => {
  const CHORD_LIST  = 'C Cm D Dm E Em F Fm G Gm A Am Bb Bbm B Bm F#m C#m Ab Eb'
  const MIDI_SUFFIX = `\n\nAt the very end, output a MIDI chord progression that matches the key, mood and reference of the track described above. Use chords that actually fit the input — do NOT default to Em-G-D-A. Output on its own line EXACTLY like this format:\nMIDI: [your chosen chords]-[chord2]-[chord3]-[chord4] BPM: [matching BPM]\nOnly use chords from this list: ${CHORD_LIST}`

  // Full-track suffix — used by generate + start modes to output all 3 MIDI parts + FL Studio guide
  const FULL_MIDI_SUFFIX = `

---
After your response, output ALL of the following lines. They must match the EXACT key, BPM, mood and genre you described above — reference the actual key and chords you chose, not generic patterns. A Am F C G is not a UK garage progression unless the track actually calls for it.

MIDI: [chord1-chord2-chord3-chord4] BPM: [exact bpm]
MELODY: [8 notes that fit your key e.g. A4-C5-E5-D5-C5-A4-G4-A4] BPM: [exact bpm]
BASS: [8 bass-register notes that groove with your chords e.g. A2-A2-F2-C3-A2-G2-F2-E2] BPM: [exact bpm]
INSTRUMENTS: Chords:[specific FL Studio synth or plugin]|Melody:[specific synth or plugin]|Bass:[specific plugin, 808 type or sample]|Drums:[specific FL Studio drum plugin or sample pack]
MIXER: Ch1:[instrument]|Ch2:[instrument]|Ch3:[instrument]|Ch4:[instrument]|Ch5:[instrument]

Rules: MIDI chords from this list only: ${CHORD_LIST}. Melody/bass notes in standard scientific notation (A4, C#3, Bb2 etc). Be specific on instruments (e.g. "Serum wavetable pad", "Flex 808", "Kick 2" — not just "synth" or "bass").`

  const pedalBlock = pedalNote ? `\nIMPORTANT: Use a pedal note approach — pick one root note in the bass register and repeat it as a drone/anchor throughout the pattern while the harmony moves above it. Common in UK garage and deep house. The BASS output should reflect this with the root note repeating.` : ''

  const beginnerBlock = beginnerMode ? `

---
**BEGINNER EXPLAINER** (add at the very end):
In plain English: what this chord progression means (e.g. "Em = E minor = dark, moody"), how to find these notes on a keyboard, what a "${chordType}" sounds like in simple terms, what the BPM feels like physically, and one tip for placing these chords in FL Studio.` : ''

  if (mode === 'start') return `You are a music producer assistant with deep knowledge of electronic music.
A producer is starting from scratch. Give them:
- Suggested BPM
- Key/scale and WHY it fits this vibe
- A chord progression for a **${chordType}** sound — name the actual chords (e.g. Am-F-C-G)
- Song structure (bars breakdown: intro → build → drop → breakdown → drop → outro)
- 2-3 specific reference tracks they can listen to
- One unique production element to make it stand out
- How to build this in FL Studio step by step (which channels to set up first)
Format with clear headers and **bold** key info.${pedalBlock}
Their vibe: ${input}${beginnerBlock}`

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
BPM, key, chord progression (name the actual chords), main sounds/instruments, song structure (bars), energy arc.

## Suno Prompt
A single paragraph under 200 characters optimised for Suno AI. Genre, mood, tempo, key sounds. No line breaks.

## Udio Prompt
More detailed version under 300 characters for Udio. Can include more musical detail.

## Stems to Extract
Once they have the generated audio, which stems to separate (drums, bass, synths, etc.) and what to do with each in their DAW.`

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

  if (mode === 'daw' && dawMode === 'setup') return `You are a music production expert helping a complete beginner get set up.
Give them a concrete setup guide based on their situation: ${input}

Cover:
- DAW recommendation and why (if they haven't chosen one)
- Essential plugins to start with (free first, then paid when ready)
- Minimum equipment list with budget options (audio interface, headphones, MIDI controller)
- How to set up their audio interface and DAW correctly
- 3 things to learn first in their chosen DAW
- 2-3 YouTube channels or resources to follow
Be specific with product names and prices where possible.`

  if (mode === 'daw' && dawMode === 'transition') return `You are an expert in multiple DAWs helping a producer switch from one DAW to another.
Their situation: ${input}

Give them:
- A direct mapping of the key concepts between their old and new DAW (e.g. "FL's Piano Roll = Ableton's MIDI clip editor, here's what's different")
- The 3 biggest workflow differences to get used to
- What they'll immediately find better
- What will feel worse at first (be honest)
- A realistic week-by-week transition plan (don't abandon their old DAW cold turkey)
- The best free resources and YouTube channels for their specific transition
Be direct and practical — they already know how to produce, they just need to remap their muscle memory.`

  if (mode === 'vocals') return `You are a professional music producer specialising in UK electronic music (UK garage, speed garage, house, techno). You are sharing your personal vocal processing chain and philosophy — built through years of production experience — to help other producers get industry-level vocal results.

YOUR CHAIN PHILOSOPHY (share this knowledge and adapt it to the user's situation):

The goal is upfront, present, pop-influenced vocals that sit IN the beat rather than floating on top of it. Think John Summit - Lights Go Out: dry-ish, intimate, controlled, with just enough space. Not drenched in reverb.

FULL SIGNAL FLOW & ROUTING (FL Studio mixer — 7 channels):

CHANNEL 1 — "Recording Chain":
- Initial tone shaping and preamp colour
- Scheps 73 (Waves) / SSL G-Channel / Waves channel strip for warmth and vintage character
- This is where the raw signal gets its fundamental character

CHANNEL 2 — "Autotune + Preamp":
- Auto-Tune Pro: Retune Speed 3 (tight, intentional electronic sound), Flex Tune 19, Natural Vibrato 1.5, Humanize 51
- Stylistic UK electronic pitch correction — it's a sound, not just correction
- Clarity Vx: de-reverb if room sound is baked into the recording
- Waves RDeEsser: FIRST de-essing pass at ~9.5kHz, Thresh -30.7, Range -22.6, SPLIT mode — catch the worst peaks BEFORE compression amplifies them
- Vocal Rider: rides the level automatically so compression doesn't have to work as hard
- Valhalla Delay: Mix 16%, Single style, 1/16 note, Spread -9ms stereo, Feedback 22%, Ducking 18%, Clarity mode, EQ High 4260Hz / Low 900Hz — musical and out of the way
- Seventh Heaven (LiquidSonics): Studio B Far preset, 2.0s decay, Pre-delay 1/64, Low cut 260Hz, High cut 3.79kHz, very low mix — subtle room, not a wash
- Alternatives for pitch: Melodyne (natural), FL Newtone (free built-in)

CHANNEL 3 — "Comp":
- Gate first (Waves R-Channel): Thresh -32.6, Release 10 — cuts room noise between phrases
- Slate Virtual Mix Rack: VCC (console colour) + FG-116 Ratio 4:1, Attack ~16ms, Release ~160ms, Circuit 1, HP sidechain
- CLA-76 (Waves): final limiting/glue, 4:1, BLUEY (all-buttons mode)
- Fresh Air (Slate): Mid 5, High 25 — air and presence lift
- Spiff (oeksound): Cut mode, Depth 5.0, Sensitivity 7.5, Decay 3.3 — controls harsh consonants without killing the snap
- Maag EQ4: Air Band +5 — always on, secret weapon for presence without harshness
- Alternatives: FabFilter Pro-C 2, TDR Kotelnikov (free), Transient Master (free)

CHANNEL 4 — "EQ":
- API-560 graphic EQ: broad tonal shaping
- Ozone 8 (Ozone 3 preset): Vintage Compressor + Dynamics + Exciter (Triode/Tape/Tape/Triode — adds harmonic saturation across the spectrum, Tape bands at Amount 2.0 Mix 100%) + Dynamic EQ + Vintage Limiter + Imager
- THE DE-ESSER SECRET: Ozone 6 Spectral Shaper targeting 2.38kHz–14.8kHz, Threshold -8.4dB, Medium mode — broadband dynamic attenuation across the whole top end, catches more than a standard de-esser
- Fruity Soft Clipper: subtle saturation/limiting
- Ozone 8 Maximizer: transparent loudness
- Ozone 8 (Ozone 12): Vintage Limiter, Threshold -0.8dB — final brick wall
- FabFilter Pro-Q 3: many surgical cuts for problem frequencies
- Maag EQ4: Air Band (second pass)
- CLA-2A: optical compression for smoothing
- RDeEsser Stereo: final de-essing pass in stereo
- Alternatives: TDR Nova (free), Voxengo Marvel GEQ (free)

CHANNEL 5 — "Final In Chain":
- Kickstart 2 (Nicky Romero): sidechain to the KICK — this is what makes the vocal lock into the groove and duck with the beat
- ValhallaVintageVerb: additional space
- Seventh Heaven: more room character
- Fruity Parametric EQ 2: final corrective EQ
- Fresh Air: Mid 10, High 14 — second fresh air hit for extra air
- Ozone 8 Dynamic EQ: Threshold -20dB, Attack 2ms, Release 14ms — reactive tonal control
- CLA-76 Mono: final mono compression
- Distructor: harmonic saturation/distortion for presence
- Fruity Peak Controller: automatable level control

MAIN VOCAL OUTPUT CHANNEL ("Official Vocal" / FL_VSH_Better_Vocal):
This is the final output channel that everything routes to. It carries the full colour and character:
- Slate Virtual Mix Rack — FOUR modules stacked: VCC Channel (console emulation) + FG-116 Modern (Ratio 4, HP sidechain) + FG-73 Brit N Pre (Virtual Drive cranked for preamp grit) + FG-116 Vintage (Ratio 4, HP sidechain) — two separate 1176 passes with console colour between them
- CLA-2A Stereo: Start Me Up preset — smooth optical glue on top of all that compression
- ValhallaDElay: PingPong mode, Tape era, Past colour, Mix 50%, L 1/16 R 1/8 (asymmetric for width), Feedback 27.4%, EQ Low 560Hz — this is a creative, present delay not a subtle one at 50% mix
- Seventh Heaven (LiquidSonics): Vocal Chamber preset, 2.00s decay — lush chamber character
- ValhallaVintageVerb: "Deep Vocal Space" preset, Chorus Space mode, NOW color, Mix 18.7%, Decay 2.00s, Pre-delay 72.76ms, HighCut 7690Hz, LowCut 480Hz, Damping 4000Hz -24dB — the Chorus Space mode adds slow chorused movement to the reverb tail for a lush, living quality
- Ozone 8 ("Ozone 18" preset): Dynamics module — multiband compression, Threshold -15dB, 10:1 Ratio, Attack 20ms, Release 100ms — this is aggressive multiband squashing across the whole signal at the output stage
- Fruity Parametric EQ 2: corrective EQ pass
- Kickstart 2: second sidechain hit to the kick at the output stage
- Fruity Parametric EQ 2: final EQ trim
- Fruity Delay 2: additional delay character at the very end of the chain

PARALLEL COMPRESSION CHANNEL (send from main vocal):
- Slate Virtual Mix Rack: VCC + FG-116 Ratio 4 + FG-116 Vintage Ratio 20 + Revival — heavily squashed
- CLA-76 Stereo: Start Me Up preset, Ratio 4, BLUEY mode
- Distructor: gritty harmonic density
- FabFilter Pro-Q 3: BIG MID BOOST around 500Hz — adds thick presence when blended in
- Blend at -18 to -20dB (NOT lower — it must be audible to add density)

STEREO WIDTH CHANNELS (two channels, one panned L one panned R):
- Fruity Love Philter: filtering/movement
- ValhallaDElay: PingPong mode, Mix 21.9%, 1/1 note, HiFi-Pop Vocal Delay setting
- ValhallaVintageVerb: Concert Hall 1970s, Mix 38.9%, Decay 1.00s, Pre-delay 500ms, Damping 6000Hz -24dB
- Keep faders around -14dB — adds full stereo width without dominating

DELAY CHANNEL (dedicated delay send):
- Abbey Road TG Mastering Chain: colour and glue
- BBDuck-Wide Vocal Delay (post-delay effect): BBD mode, Mix 100%, 1/2 note — vintage tape/BBD character
- Seventh Heaven: Rich Plate preset, Pre-delay 0ms, Low cut 97Hz, High cut 10.8kHz
- Seventh Heaven adds smooth plate underneath the delay tail

SECONDARY PROCESSING CHANNEL (Insert 69 — for loop/doubled vocal elements):
- CLA-2A Stereo + Virtual Mix Rack (FG-73 + FG-116 Modern + Revival + Trimmer)
- Pro-Q 3: surgical cuts in low-mids + body, boost around 1.7kHz
- Fresh Air
- Pro-Q 3: second surgical pass
- Fruity Reeverb 2 (FL Studio's free built-in reverb) — proof you don't always need expensive plugins for everything
- Fader at -14.4dB in the mix

GAIN STAGING:
- Aim for vocal peaking around -6dBFS going into each processing stage
- Final vocal in the mix: start around -11 to -14dBFS and adjust to the track
- Parallel comp bus at -18 to -20dB
- Stereo width channels at ~-14dB

KEY PRODUCTION INSIGHTS:
1. Kickstart 2 sidechain to kick happens TWICE — on the final chain AND on the main output — the groove lockdown is intentional and layered
2. The main output VMR stacks 4 modules including two separate 1176-style compressors (Modern + Vintage) — you're compressing with two different circuit characteristics back to back
3. ValhallaVintageVerb Chorus Space mode = the reverb modulates and moves, giving the tail a living, lush quality rather than static room sound
4. The Ozone 3 Exciter (Triode/Tape) in the EQ channel adds harmonic saturation across frequency bands — it's a mastering tool used as a vocal colour tool
5. ValhallaDElay at 50% mix on the main channel is a creative effect as much as a mixing tool — this is not subtle
6. Fruity Reeverb 2 on secondary vocals proves that expensive reverbs aren't always necessary — use what serves the sound
7. Two de-essing approaches: surgical (RDeEsser Split mode) + broadband spectral (Ozone Spectral Shaper) — different tools catching different problems
8. Fresh Air appears twice (comp channel AND final chain) — building air gradually rather than one heavy hit

Now give the user specific advice for THEIR situation: ${input}
Adapt the chain above to their DAW, plugins, and budget. Always give free alternatives. If they have budget, tell them which plugins from this chain are worth buying first.`

  if (mode === 'djset') return `You are an experienced DJ helping plan a professional set.
Event: ${djSetEvent} | Duration: ${djSetDuration} | Energy arc: ${djSetEnergy}
Genre/vibe/details: ${input}

Structure the set plan with these exact sections:

## Set Overview
2-3 sentences on the overall approach and vibe.

## BPM Arc
Show the BPM journey across the set (e.g. "Open at 120 BPM → build to 128 by the 30-min mark → peak at 132 → cool to 125 for closing"). Be specific with numbers.

## Set Structure (broken into phases)
For each phase give: time range, BPM range, energy level (1-10), what the crowd should be feeling, 3-4 track types or specific track/artist recommendations that fit that moment.

## Key Transitions
3-4 specific transition techniques to use at the most important moments in the set (with exact timing).

## What to Avoid
2-3 common mistakes for this type of event/crowd.`

  if (mode === 'visuals') return `You are an expert in music visuals, VFX tools, and creative technology.
Help this producer/DJ find the right visual tools for their situation: ${input}

Give:

## Live Performance Visuals
3-4 tools for real-time visuals during a set (e.g. Resolume, TouchDesigner, VDMX). For each: what it does, skill level required, price, and why it suits their genre.

## Promotional Content
3 tools or approaches for creating visual content to market their music (social clips, album art, video teasers). Free options first.

## AI Visual Tools
2-3 AI tools (Runway, Sora, etc.) that can generate visuals from audio or prompts — useful for music videos and social content without a film crew.

## Where to Start
A clear recommended first step based on their situation — one tool to focus on first and why.`

  if (mode === 'master') return `You are a professional music producer and mastering engineer specialising in UK electronic music (UK garage, speed garage, house, techno). You are sharing your personal master channel chain and philosophy — built from real production experience — to help producers get loud, wide, punchy masters that work on club systems and streaming.

YOUR MASTER CHAIN PHILOSOPHY:
The goal is a loud, wide, punchy master that sounds great on big club speakers AND earbuds. Target around -7 to -9 LUFS for club/dance music, -10 to -14 LUFS if you also want Spotify unclipped. The chain below uses heavy processing but every stage has a specific job.

FULL MASTER CHAIN SIGNAL FLOW (FL Studio Mixer — Master Channel):

STAGE 1 — Virtual Mix Rack #1 (Console + Preamp Colour):
- VCC Channel: console emulation, adds harmonic density and glue
- FG-73 Brit N Pre: preamp character, Virtual Drive cranked for grit and warmth
- FG-S Brit 4K EQ: broad tonal shaping (SSL 4000-style EQ on the master)
- FG-116 Modern: 1176-style compression, Ratio 4, HP sidechain — first compression pass on the master

STAGE 2 — FabFilter Pro-Q 3 (M/S Surgical EQ):
- Mid/Side mode — treating the middle and sides independently
- Deep surgical notch around 300-400Hz in the mid (killing build-up in the centre)
- Multiple small cuts across the mid for problem frequencies
- Gentle boosts on the sides to add width without touching the mono centre
- This is where you clean up whatever the mix left behind

STAGE 3 — Virtual Mix Rack #2 (Second Console Pass):
- FG-S Brit 4K EQ: second tonal pass
- FG-116 Modern: second 1176 compression pass (Ratio 4, HP sidechain)
- Revival: harmonic exciter for shimmer and thickness
- Trimmer: gain staging between stages

STAGE 4 — Ozone 8 ("Ozone 2" preset — 6 modules):
- Vintage Compressor: Threshold -12.3dB, Ratio 1.9:1, Attack 20ms, Release 30ms, Balanced mode — gentle glue compression across the whole master
- Exciter: ALL FOUR BANDS set to Tape mode, Amount 3/3/3/2, Mix 100% — adds tape harmonic saturation across the full spectrum with oversampling on. This is what gives the master that analogue warmth and density.
- Dynamic EQ (M/S): Side channel boosts around 800Hz-2kHz (adds width in the upper mids), Mid channel cuts at 110Hz, 400Hz, 600Hz + boost at 1kHz — reactive EQ that responds to the music
- Vintage Limiter: Tube mode, Threshold -3.0dB, Ceiling -1.6dB, Character 2.93 — first limiting stage with tube character
- Imager: Band 1 Width -25.0 (NARROW the low end for mono bass), Band 2 +35.0, Band 3 +30.0, Band 4 +19.0, Stereoize 15ms — multiband stereo widening while keeping the sub mono (essential for club playback)
- Maximizer: IRC II mode, Balanced, Threshold -4.0dB, Character 5.10, Sustain 30%, Target -14.0 LUFS (True Peak ceiling 0.0dB)

STAGE 5 — Scheps 73 Stereo (M/S Mode):
- Preamp saturation and EQ in M/S mode — treating mid and sides independently
- HP filter at 50Hz on both channels
- Vintage Neve-style colour on the master

STAGE 6 — TransX Multi Stereo (Multiband Transient Shaper):
- Low 83Hz / Mid 450Hz / High 6809Hz crossovers
- Range 4.0 / 3.0 / 3.0 / 3.0 across bands
- Duration 4.98s, Sens 0.0
- Controls the transient punch of different frequency ranges — tightens the low end, adds snap to the mids

STAGE 7 — Abbey Road TG Mastering Chain (4 modules):
- TG12411: Tape Equalizer with Pole L character and Phase adjustment
- TG12412: Tone EQ — broad musical shaping across HF, HMF, LMF, LF
- TG12413: Limiter with SC Filters, Gate, Expander, Recovery control
- TG12414: Filter section with high-pass, low-pass, Presence control, Spreader
- This is the vintage EMI/Abbey Road character — adds the analogue tape/console quality that makes the master feel "finished"

STAGE 8 — Virtual Mix Rack #3 (Third Console Pass):
- FG-S Brit 4K EQ: third EQ pass
- FG-116 Modern: third 1176 compression pass (Ratio 4, HP sidechain)
- Revival + Trimmer

STAGE 9 — SSL G-Channel Stereo (Full Channel Strip):
- Complete SSL G-Series channel strip on the master — EQ + Dynamics together
- Filters: HF, HMF, LMF, LF all active
- Dynamics: Gate + Compressor + Expander all routed
- Analog: ON — adds noise/analogue character
- This acts as a final glue and colour stage before the last limiter

STAGE 10 — Ozone 8 ("Ozone 3" preset — Dynamics only):
- Multiband parallel compression on ALL 4 BANDS, all set to Parallel 100 (fully parallel)
- Band 1 (sub-196Hz): Compressor -14.4dB, 4.3:1, Attack 43ms Release 8ms + second comp 2.0:1, Gain +2.0dB
- Band 2 (196-500Hz): Compressor -15.0dB, 4.0:1, Attack 33ms Release 6ms + second comp 3.0:1, Gain +3.0dB
- Band 3 (500Hz-2kHz): Compressor -17.4dB, 4.5:1, Attack 39ms Release 27ms + second comp 2.0:1, Gain +3.0dB
- Band 4 (2kHz-10kHz): Compressor -25.8dB, 4.1:1, Attack 20ms Release 37ms + second comp 2.5:1, Gain +1.2dB
- Adaptive Release on, Auto mode
- This is the final density and loudness stage — adds thickness, punch, and perceived loudness without hard clipping

KEY MASTERING INSIGHTS:
1. THREE separate VMR instances = building console colour gradually rather than hammering it once
2. The Ozone Imager NARROWS Band 1 (-25.0) — mono bass is essential for club systems. If the sub is wide, it disappears on club speakers.
3. Tape Exciter on ALL FOUR BANDS across the master adds harmonic saturation everywhere — this is what makes the master sound "full" at lower volumes
4. The TG Mastering Chain is the final "analogue feel" — without it the master can sound too clean and digital
5. Parallel multiband compression (Ozone 3) is the last loudness trick — you're adding compressed density without touching the uncompressed transients
6. M/S processing at multiple stages (Pro-Q 3, Ozone Dynamic EQ, Scheps 73) lets you control the centre and sides independently — tighten the mid, widen the sides

Now give the user specific advice for THEIR situation: ${input}
Adapt the chain above to their DAW, plugins, and situation. If they have none of these plugins, give a free alternative mastering chain that still achieves the same goals. Always explain WHY each stage matters.`

  if (mode === 'release') return `You are a music marketing strategist specialising in independent electronic music releases — UK garage, speed garage, house, and techno. You help independent artists release music without a label and build real momentum.

Track/artist details: ${input}

Generate a complete release plan with these exact sections:

## Release Overview
2-3 sentences on the overall strategy and positioning for this release.

## Release Timeline
Work backwards from the release date (or suggest one if not given). Format as:
- **[X weeks out]**: what to do
Cover: finalising the master, DistroKid/TuneCore submission (needs 1-2 weeks lead time), Spotify for Artists editorial pitch (must be submitted 7 days before release), artwork finalisation, social content prep.

## Week-by-Week Content Plan
Break down what to post each week leading up to release. Be specific — not "post a clip" but "post a 15-second FL Studio session clip of the drop with the track playing in the background, no talking needed." Give 3-4 post ideas per week across Instagram Reels and TikTok.

## Playlist & Blog Submission Targets
List 6-8 specific UK garage / electronic music playlists on Spotify worth pitching to (real playlist names). List 3-4 blogs or music outlets that cover this genre (real names like Dummy Mag, The Wire, Notion, Data Transmission, Trench, etc). Include SubmitHub as the submission method.

## Spotify Editorial Pitch Template
Write a ready-to-use pitch for Spotify for Artists editorial submission — 150 words max, first person, describes the track's sound, mood, influences, and why it fits on New Music Friday / relevant genre playlists.

## Post-Release (First 2 Weeks)
What to do after it drops to maintain momentum — response content, engaging comments, pitching to algorithmic playlists, monitoring Spotify for Artists stats.

## Key Platforms to Focus On
Rank 3 platforms in order of priority for THIS type of music and THIS artist's situation, with a one-line reason for each.`

  if (mode === 'dj') return `You are a DJ and music production expert creating a learning roadmap.
Their situation: ${input}

First write 2-3 sentences of intro advice. Then output EXACTLY this format for 4 stages, no extra text between stages:

STAGE[1]: {short title} | {timeframe} | {what to focus on, 1 sentence} | {specific gear recommendation with price}
STAGE[2]: {short title} | {timeframe} | {what to focus on, 1 sentence} | {gear upgrade or "keep current setup"}
STAGE[3]: {short title} | {timeframe} | {what to focus on, 1 sentence} | {gear recommendation}
STAGE[4]: {short title} | {timeframe} | {what to focus on, 1 sentence} | {gear recommendation}

After the stages, add a "## Key Skills to Learn First" section with 5 ordered skills, and a "## Resources" section with 3 YouTube channels.
Use their production knowledge as an advantage where relevant.`

  return input
}

// ─── Guide content ────────────────────────────────────────────────────────────
const GUIDE = [
  {
    id: 'start',
    icon: '🎹',
    title: 'Start From Nothing',
    what: "You've got a blank project and no idea where to start. This gives you a BPM, key, chord progression, song structure, and reference tracks.",
    examples: [
      'Dark UK garage, late night feel, 130 BPM',
      'Techy minimal house, hypnotic, 124 BPM',
      'Speed garage banger, aggressive energy, rolling bassline',
      'Dreamy deep house, 120 BPM, warm chords',
    ],
    tip: 'Pick "Chords" to also get a downloadable MIDI file you can drag straight into FL Studio.',
  },
  {
    id: 'stuck',
    icon: '🔁',
    title: 'I Have Something',
    what: "You've got a loop but you're stuck. Tell me what you have and I'll give you 3 specific directions to move the track forward.",
    examples: [
      "4-bar loop with an Em pad and a rolling bassline, don't know what to add next",
      'I have a rave-y techno loop at 140 BPM, energy feels flat',
      'Got a vocal chop and kick pattern but no direction yet',
    ],
    tip: 'The more detail you give, the better the directions. Mention your BPM, key, what sounds you have, and what feels missing.',
  },
  {
    id: 'lyrics',
    icon: '✍️',
    title: 'Lyric Concepts',
    what: "Raw themes, imagery, and hook fragment ideas to spark your own writing. Not cheesy full lyrics — just the material to write from.",
    examples: [
      'Driving through London at 3am, paranoid energy',
      'The feeling of losing someone slowly, not suddenly',
      'Late night raving, feeling disconnected from reality',
      'Ambition and doubt at the same time',
    ],
    tip: "This won't write your lyrics for you — it gives you the raw ingredients. Take what resonates and build from there.",
  },
  {
    id: 'sounds',
    icon: '🎧',
    title: 'Sound Discovery',
    what: "Beyond Splice. Find new sample packs, platforms, and producers to sample-hunt from — plus creative ways to flip what you find.",
    examples: [
      'I mainly use Splice and keep using the same sounds. I make speed garage',
      'Looking for raw vinyl-sounding drum breaks',
      'Need gritty UK vocal samples for garage',
      'I want unique FX and riser sounds for techno',
    ],
    tip: 'Mention your genre and what specifically feels stale — that way the suggestions are targeted, not generic.',
  },
  {
    id: 'mix',
    icon: '🎚️',
    title: 'Mix Advice',
    what: "Surgical mixing tips with exact EQ frequencies, compression settings, and specific plugin recommendations (free ones first).",
    examples: [
      'Kick gets buried under the bassline in my speed garage track',
      'My mix sounds muddy in the low mids',
      'Snare feels weak and thin on a hi-fi system',
      'Everything sounds fine in headphones but bad on speakers',
    ],
    tip: 'Mention your DAW and the plugins you already have — the advice will be tailored to your setup.',
  },
  {
    id: 'design',
    icon: '🔊',
    title: 'Sound Design',
    what: "Step-by-step patch guides to recreate any sound, with exact synth parameter values, FX chains, and plugin settings.",
    examples: [
      'I want a synth like John Summit – Where You Are. Warm, slightly distorted house lead',
      'That stabby chord sound in UK garage from the early 2000s',
      'Gritty reese bass for techno, lots of movement',
      'Wide ethereal pad that evolves slowly',
    ],
    tip: 'Select your synth (Serum, Vital, etc.) first — the guide will use that synth\'s exact parameter names.',
  },
  {
    id: 'generate',
    icon: '🎵',
    title: 'Generate Track',
    what: "Creates a full track brief plus an optimised Suno/Udio prompt you can paste directly into those AI music tools.",
    examples: [
      'Dark UK garage, 130 BPM, late night paranoid energy, gritty sub bass',
      'Hypnotic minimal techno, 138 BPM, warehouse feel',
      'Deep house, slow build, warm chords, jazzy samples',
    ],
    tip: 'After generating in Suno/Udio, use the "Stem extraction" section in the result to know which parts to pull into your DAW.',
  },
  {
    id: 'sample',
    icon: '🎙️',
    title: 'Analyse Sample',
    what: "Upload any audio file and get real measurements — peak level, RMS, frequency content, stereo width — then specific mixing advice based on those numbers.",
    examples: [
      'Upload a kick that sounds muddy → get exact EQ cuts with Hz and dB values',
      'Upload a bassline that distorts → get compression settings to tame the peaks',
      'Upload a pad that sounds thin → get layering and reverb suggestions',
    ],
    tip: 'No upload? Just describe the sound in the notes box and you\'ll still get useful advice — the upload just makes it more precise.',
  },
]

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Navigation & UI ──────────────────────────────────────────────────────────
  // mode: which tool is active. null = home screen (mode grid shown).
  // Changing mode via resetMode() clears all input/result state automatically.
  const [mode, setMode] = useState(null)
  const [showGuide, setShowGuide] = useState(false)   // ? modal open/closed
  const [showHistory, setShowHistory] = useState(false) // history drawer open/closed
  const [copied, setCopied] = useState(false)           // clipboard feedback

  // ── Core input / output ───────────────────────────────────────────────────────
  // These are shared by most modes. The textarea binds to `input`, AI response
  // streams into `result`, and `loading` drives the spinner + disabled state.
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Thinking...')

  // ── Mode-specific controls ────────────────────────────────────────────────────
  const [chordType, setChordType] = useState('Pad')        // start/stuck: chord sound type
  const [midiType, setMidiType] = useState('chord')         // non-full-track modes
  const [beginnerMode, setBeginnerMode] = useState(false)   // plain English explainer toggle
  const [pedalNote, setPedalNote] = useState(false)         // UK garage drone bass toggle
  const [selectedSynth, setSelectedSynth] = useState('')    // sound design: which synth
  const [dawMode, setDawMode] = useState('setup')           // daw: 'setup' | 'transition'
  const [djSetEvent, setDjSetEvent] = useState('Club Night')
  const [djSetDuration, setDjSetDuration] = useState('2 hours')
  const [djSetEnergy, setDjSetEnergy] = useState('Slow build to peak')
  const [djRoadmapData, setDjRoadmapData] = useState(null)  // parsed stage cards from AI

  // ── MIDI ──────────────────────────────────────────────────────────────────────
  // midiData holds the generated MIDI — either a single file or the full 3-file object.
  // isFullTrack:true = start/generate modes (chord + melody + bass).
  // isFullTrack:false = single chord file (stuck/mix etc).
  const [midiData, setMidiData] = useState(null)
  const [generatingMidi, setGeneratingMidi] = useState(false) // second AI call in progress

  // ── Conversation / follow-up ──────────────────────────────────────────────────
  // conversationHistory is the full message array sent back to the AI each follow-up.
  // Keeps context across the whole conversation for the active mode.
  const [conversationHistory, setConversationHistory] = useState([])
  const [followUpInput, setFollowUpInput] = useState('')

  // ── Sample analysis (sample mode) ────────────────────────────────────────────
  // File is read by analyzeAudioFile() which runs Web Audio API locally in the browser.
  // The measured numbers (peak, RMS, bands) are sent to AI — not the audio itself.
  const [sampleFile, setSampleFile] = useState(null)
  const [sampleAnalysis, setSampleAnalysis] = useState(null)
  const [analysingAudio, setAnalysingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [sampleInstrument, setSampleInstrument] = useState('Kick')
  const [sampleDesc, setSampleDesc] = useState('')

  // ── Stereo field analyzer (stereo mode) ──────────────────────────────────────
  // Uses Goertzel algorithm to measure L/R energy split across 7 frequency bands.
  // stereoFieldData is the parsed AI response: { actual[], ideal[], feedback }.
  // StereoFieldPanel renders it as an SVG bird's-eye stage diagram.
  const [stereoFile,      setStereoFile]      = useState(null)
  const [stereoAnalysis,  setStereoAnalysis]  = useState(null)
  const [analysingStereo, setAnalysingStereo] = useState(false)
  const [stereoError,     setStereoError]     = useState('')
  const [stereoGenre,     setStereoGenre]     = useState('')
  const [stereoFieldData, setStereoFieldData] = useState(null)

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const fileInputRef    = useRef(null)  // hidden <input type="file"> for sample upload
  const stereoFileRef   = useRef(null)  // hidden <input type="file"> for stereo upload
  const loadingTimerRef = useRef(null)  // interval ID for rotating loading messages
  const resultRef       = useRef(null)  // scrollIntoView target when generation starts

  // ── Completion Engine state ───────────────────────────────────────────────────
  // completionStage: 0=entry screen, 1-5=active stages, 6=celebration/done
  // completionTrack: built up as stages complete
  //   { name, commitment, bpm, key, vibe, direction, structure, structureTips, feedback[] }
  // completionDecisions: permanent log of stage 3 picks
  // completionDecisionOptions: [{question, optionA, optionB}] shown one at a time
  // completionHistory: localStorage — all finished tracks across sessions
  const [completionStage,           setCompletionStage]           = useState(0)
  const [completionTrack,           setCompletionTrack]           = useState(null)
  const [completionInput,           setCompletionInput]           = useState('')
  const [completionResult,          setCompletionResult]          = useState('')
  const [completionLoading,         setCompletionLoading]         = useState(false)
  const [completionDecisions,       setCompletionDecisions]       = useState([])
  const [completionCurrentDecision, setCompletionCurrentDecision] = useState(0)
  const [completionDecisionOptions, setCompletionDecisionOptions] = useState([])
  const [completionDecisionPicks,   setCompletionDecisionPicks]   = useState({})
  const [completionFile,            setCompletionFile]            = useState(null)
  const [completionAnalysis,        setCompletionAnalysis]        = useState(null)
  const [completionChecklist,       setCompletionChecklist]       = useState([false,false,false,false,false])
  const [completionShowCelebration, setCompletionShowCelebration] = useState(false)
  const [showDescription,           setShowDescription]           = useState(false)
  const [isDragging,                setIsDragging]                = useState(false)
  const [completionError,           setCompletionError]           = useState('')
  const [completionTrackName,       setCompletionTrackName]       = useState('')
  const [historySearch,             setHistorySearch]             = useState('')
  const [completionHistory,         setCompletionHistory]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('completionHistory') || '[]') } catch { return [] }
  })

  const [trackStage, setTrackStage] = useState( 
    ()=> {
      try{return JSON.parse(localStorage.getItem('trackStage')) // will track null if nothing saved
      }catch{return null}
    }
  )
  // Completion constants
  const circumference = 2 * Math.PI * 40  
  const progress = STAGE_PROGRESS[trackStage] ?? 0  // e.g. 75
  const offset = circumference * (1 - progress / 100)


  const completionFileRef = useRef(null)
  const audioRef          = useRef(null)
  const [audioPlaying,     setAudioPlaying]     = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration,    setAudioDuration]    = useState(0)
  const [audioUrl,         setAudioUrl]         = useState(null)

  const [chordHistory, setChordHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chordHistory') || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('chordHistory', JSON.stringify(chordHistory))
  }, [chordHistory])

  useEffect(() => {
    localStorage.setItem('completionHistory', JSON.stringify(completionHistory))
  }, [completionHistory])

  // ── Scroll result into view when generation starts ──
  useEffect(() => {
    if (loading && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  // ── Rotate loading messages ──
  useEffect(() => {
    if (loading) {
      const msgKey = mode === 'daw' ? (dawMode === 'transition' ? 'transition' : 'daw') : mode
      const msgs = LOADING_MSGS[msgKey] || ['Thinking...']
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

  // Track Stage: persist stage
  useEffect(() => {
    localStorage.setItem('trackStage', JSON.stringify(trackStage))
  }, [trackStage])

  // ── Audio player: create blob URL when file is set. Don't destroy on session reset — player stays alive until user dismisses it.
  useEffect(() => {
    if (!completionFile) return
    const url = URL.createObjectURL(completionFile)
    setAudioUrl(url)
    setAudioCurrentTime(0)
    return () => URL.revokeObjectURL(url)
  }, [completionFile])

  // ── Enter key to submit on Completion Engine entry screen ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && completionStage === 0 && mode === 'completion' && !completionLoading) {
        handleBeginCompletion()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [completionStage, mode, completionLoading, completionFile, completionInput, trackStage])

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

  const handleStereoFileSelect = async (file) => {
    if (!file) return
    setStereoFile(file)
    setStereoAnalysis(null)
    setStereoError('')
    setAnalysingStereo(true)
    try {
      const analysis = await analyzeStereoField(file)
      setStereoAnalysis(analysis)
    } catch (err) {
      setStereoError(err.message)
    } finally {
      setAnalysingStereo(false)
    }
  }

  const midiTypeIcon = { chord: '🎹', melody: '🎵', bass: '🔉' }

  // ── Core generation (shared by initial + follow-up) ──
  const runGeneration = async (messages) => {
    setLoading(true)
    setResult('')
    setMidiData(null)
    setDjRoadmapData(null)
    setCopied(false)
    let accumulated = ''
    try {
      await callAI(messages, (chunk) => {
        accumulated += chunk
        setResult(accumulated)
      })
      const djStages = parseDJRoadmap(accumulated)
      const cleaned  = cleanResult(accumulated)
      setResult(cleaned)
      if (djStages) setDjRoadmapData(djStages)

      // Full-track modes (generate + start) → parse all 3 MIDI parts at once
      const isFullTrackMode = mode === 'generate' || mode === 'start'
      if (isFullTrackMode) {
        const allParsed = parseAllMidi(accumulated)
        if (allParsed) {
          const midiResult = { isFullTrack: true }
          if (allParsed.chord)  midiResult.chord  = { ...allParsed.chord,  uri: generateChordMidi(allParsed.chord.notes, allParsed.chord.bpm) }
          if (allParsed.melody) midiResult.melody = { ...allParsed.melody, uri: generateNoteMidi(allParsed.melody.notes, allParsed.melody.bpm) }
          if (allParsed.bass)   midiResult.bass   = { ...allParsed.bass,   uri: generateNoteMidi(allParsed.bass.notes,   allParsed.bass.bpm)   }
          if (allParsed.instruments) midiResult.instruments = allParsed.instruments
          if (allParsed.mixer)       midiResult.mixer       = allParsed.mixer
          setMidiData(midiResult)
        }
      } else {
        // Single-MIDI modes (stuck, mix, etc.)
        const parsed = parseMidiLine(accumulated)
        if (parsed) {
          const uri = parsed.type === 'chord'
            ? generateChordMidi(parsed.notes, parsed.bpm)
            : generateNoteMidi(parsed.notes, parsed.bpm)
          setMidiData({ isFullTrack: false, ...parsed, uri })
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

    // ── Stereo mode: dedicated flow ──────────────────────────────────────────
    if (mode === 'stereo') {
      if (!stereoAnalysis) return
      setLoading(true)
      setResult('')
      setStereoFieldData(null)
      let accumulated = ''
      try {
        const prompt = buildStereoPrompt(stereoAnalysis, stereoGenre)
        await callAI([{ role: 'user', content: prompt }], (chunk) => { accumulated += chunk })
        const parsed = parseStereoField(accumulated)
        if (parsed) {
          setStereoFieldData(parsed)
          setResult(parsed.feedback
            ? `**Stereo Field Analysis**\n\n${parsed.feedback}\n\nThe 3D map below shows your actual stereo field vs the ideal layout for your genre.`
            : 'Analysis complete — see the stereo field map below.')
        } else {
          setResult('Could not parse stereo data — try again.')
        }
        setConversationHistory([
          { role: 'user', content: prompt },
          { role: 'assistant', content: accumulated },
        ])
      } catch (err) {
        setResult('Error: ' + err.message)
      } finally {
        setLoading(false)
      }
      return
    }

    const prompt   = buildPrompt({ mode, input, chordType, midiType, beginnerMode, pedalNote, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis, dawMode, djSetEvent, djSetDuration, djSetEnergy })
    const messages = [{ role: 'user', content: prompt }]
    const response = await runGeneration(messages)
    setConversationHistory([
      { role: 'user', content: prompt },
      { role: 'assistant', content: response },
    ])
    // Divide & conquer: second focused call just for MIDI data
    const isFullTrackMode = mode === 'generate' || mode === 'start'
    if (isFullTrackMode && response && !response.startsWith('Error:')) {
      await generateMidiForTrack(input, response)
    }
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
  // ── Second focused call: generate MIDI data after the main text response ──
  const generateMidiForTrack = async (userInput, trackBrief) => {
    setGeneratingMidi(true)
    try {
      const midiPrompt = buildMidiOnlyPrompt(userInput, trackBrief)
      let midiText = ''
      await callAI([{ role: 'user', content: midiPrompt }], (chunk) => { midiText += chunk })
      const allParsed = parseAllMidi(midiText)
      if (allParsed) {
        const midiResult = { isFullTrack: true }
        if (allParsed.chord)       midiResult.chord       = { ...allParsed.chord,  uri: generateChordMidi(allParsed.chord.notes, allParsed.chord.bpm) }
        if (allParsed.melody)      midiResult.melody      = { ...allParsed.melody, uri: generateNoteMidi(allParsed.melody.notes, allParsed.melody.bpm) }
        if (allParsed.bass)        midiResult.bass        = { ...allParsed.bass,   uri: generateNoteMidi(allParsed.bass.notes,   allParsed.bass.bpm)   }
        if (allParsed.instruments) midiResult.instruments = allParsed.instruments
        if (allParsed.mixer)       midiResult.mixer       = allParsed.mixer
        setMidiData(midiResult)
      }
    } catch (err) {
      console.error('MIDI generation error:', err)
    } finally {
      setGeneratingMidi(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const canGenerate = mode === 'sample'
    ? (sampleAnalysis != null || sampleDesc.trim().length > 0)
    : mode === 'stereo'
      ? stereoAnalysis != null
      : input.trim().length > 0

  // Helper: fully reset completion engine session (keeps history)
  const resetCompletionSession = () => {
    setCompletionStage(0); setCompletionTrack(null); setCompletionInput(''); setCompletionResult('')
    setCompletionDecisions([]); setCompletionCurrentDecision(0); setCompletionDecisionOptions([])
    setCompletionFile(null); setCompletionAnalysis(null)
    setCompletionChecklist([false,false,false,false,false]); setCompletionShowCelebration(false)
    setCompletionTrackName('')
  }

  const resetMode = (id) => {
    setMode(id); setInput(''); setResult(''); setMidiData(null)
    setSampleFile(null); setSampleAnalysis(null); setAudioError('')
    setConversationHistory([]); setFollowUpInput(''); setDjRoadmapData(null)
    setStereoFile(null); setStereoAnalysis(null); setStereoError(''); setStereoFieldData(null); setStereoGenre('')
    if (id !== 'completion') resetCompletionSession()
  }

  // ── Completion Engine handlers ──────────────────────────────────────────────

  // Stage 0 → 1: Begin — run idea lock AI
  const handleBeginCompletion = async () => {
    if (!completionFile && !completionInput.trim()) {
      setCompletionError('Upload a file or add a description to continue.')
      return
    }
    if (!trackStage) {
      setCompletionError('Choose a stage before proceeding.')
      return
    }
    setCompletionError('')
    setCompletionStage(1)
    setCompletionLoading(true)
    setCompletionResult('')
    setCompletionTrack(null)
    try {
      const prompt = buildIdeaLockPrompt(completionInput, completionAnalysis)
      let text = ''
      await callAI([{ role: 'user', content: prompt }], (chunk) => { text += chunk })
      const parsed = parseIdeaLock(text)
      if (parsed) {
        const untitledCount = completionHistory.filter(t => t.name.startsWith('Untitled')).length
        const autoName = completionTrackName.trim() || `Untitled ${untitledCount + 1}`
        setCompletionTrack({ name: autoName, ...parsed })
        setCompletionResult(text)
      } else {
        setCompletionResult(text || 'Could not parse response — try again.')
      }
    } catch (err) {
      setCompletionResult('Error: ' + err.message)
    } finally {
      setCompletionLoading(false)
    }
  }

  // Stage 1 → 2: Lock it in
  const handleLockIn = () => {
    setCompletionStage(2)
    setCompletionResult('')
  }

  // Stage 2: Generate structure
  const handleGenerateStructure = async () => {
    if (!completionTrack) return
    setCompletionLoading(true)
    setCompletionResult('')
    try {
      const prompt = buildStructurePrompt(completionTrack.commitment, completionTrack.bpm, completionTrack.vibe)
      let text = ''
      await callAI([{ role: 'user', content: prompt }], (chunk) => { text += chunk })
      const parsed = parseStructure(text)
      setCompletionTrack(t => ({ ...t, structure: parsed.structure, structureTips: parsed.tips }))
      setCompletionResult(text)
    } catch (err) {
      setCompletionResult('Error: ' + err.message)
    } finally {
      setCompletionLoading(false)
    }
  }

  // Stage 2 → 3: Confirm structure
  const handleConfirmStructure = () => {
    setCompletionStage(3)
    setCompletionResult('')
  }

  // Stage 3: Get 3 forced decisions from AI
  const handleGetDecisions = async () => {
    if (!completionTrack) return
    setCompletionLoading(true)
    setCompletionDecisionOptions([])
    setCompletionCurrentDecision(0)
    try {
      const prompt = buildForcedDecisionsPrompt(
        completionTrack.commitment,
        completionTrack.structure || '',
        completionTrack.bpm,
        completionTrack.vibe,
      )
      let text = ''
      await callAI([{ role: 'user', content: prompt }], (chunk) => { text += chunk })
      const decisions = parseForcedDecisions(text)
      if (decisions.length > 0) {
        setCompletionDecisionOptions(decisions)
      } else {
        setCompletionResult('Could not parse decisions — try again.')
      }
    } catch (err) {
      setCompletionResult('Error: ' + err.message)
    } finally {
      setCompletionLoading(false)
    }
  }

  // Stage 3: commit selected decisions (auto-pick recommended if skipped) and move to stage 4
  const handleCommitDecisions = () => {
    const entries = completionDecisionOptions.map((opt, i) => {
      const picked = completionDecisionPicks[i]
      if (picked) return `${opt.question} → ${picked}`
      // fallback: use AI's recommended option
      const fallback = opt.recommended === 'B' ? opt.optionB : opt.optionA
      return `${opt.question} → ${fallback} (AI pick)`
    })
    setCompletionDecisions(entries)
    setCompletionStage(4)
    setCompletionResult('')
    setCompletionInput('')
  }

  // Stage 3: Confirm one decision, advance or move to stage 4
  const handleConfirmDecision = (choice) => {
    const current = completionDecisionOptions[completionCurrentDecision]
    if (!current) return
    const entry = `${current.question} → ${choice}`
    const isLast = completionCurrentDecision >= completionDecisionOptions.length - 1
    setCompletionDecisions(prev => [...prev, entry])
    if (isLast) {
      setCompletionStage(4)
      setCompletionResult('')
      setCompletionInput('')
    } else {
      setCompletionCurrentDecision(d => d + 1)
    }
  }

  // Stage 4: Run feedback pass
  const handleGetFeedback = async () => {
    if (!completionTrack) return
    setCompletionLoading(true)
    setCompletionResult('')
    try {
      const draftNote = completionInput.trim() ? `\nProducer's notes on current state: ${completionInput}` : ''
      const prompt = buildFeedbackPrompt(
        completionTrack.commitment,
        completionDecisions,
        (completionTrack.structure || '') + draftNote,
      )
      let text = ''
      await callAI([{ role: 'user', content: prompt }], (chunk) => { text += chunk })
      const feedback = parseFeedback(text)
      setCompletionTrack(t => ({ ...t, feedback: feedback.length > 0 ? feedback : null }))
      setCompletionResult(text)
    } catch (err) {
      setCompletionResult('Error: ' + err.message)
    } finally {
      setCompletionLoading(false)
    }
  }

  // Stage 4 → 5: Move to export
  const handleMoveToExport = () => {
    setCompletionStage(5)
    setCompletionResult('')
  }

  // Stage 5: Toggle checklist item
  const handleChecklistToggle = (i) => {
    setCompletionChecklist(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  // Stage 5: Mark finished + celebrate
  const handleMarkFinished = () => {
    if (!completionChecklist.every(Boolean) || !completionTrack) return
    const finished = {
      id:           Date.now(),
      name:         completionTrack.name,
      bpm:          completionTrack.bpm,
      key:          completionTrack.key,
      vibe:         completionTrack.vibe,
      dateFinished: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    }
    setCompletionHistory(prev => [finished, ...prev])
    setCompletionStage(6)
    setCompletionShowCelebration(true)
  }

  // Stage 6 → start new
  const handleCompletionNewTrack = () => {
    resetCompletionSession()
  }

  const handleDeleteTrack = (id) => {
    setCompletionHistory(prev => prev.filter(t => t.id !== id))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // JSX RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  //
  //  ALWAYS VISIBLE
  //  ├── Header (title + ? + History buttons)
  //  ├── History panel (chord history drawer — toggles via showHistory)
  //
  //  HOME SCREEN  (only when mode === null)
  //  └── Mode grid: Completion Engine card → tool tiles → DJ → Visuals → Release
  //
  //  ACTIVE MODE  (only when mode !== null)
  //  ├── Back button + mode chip
  //  │
  //  ├── [completion only]  Completion Engine stages 0–6
  //  │
  //  └── [all other modes]  Standard input panel
  //      ├── Mode-specific controls (chord type, synth picker, DAW toggle, etc.)
  //      ├── Main textarea (or file upload for sample/stereo modes)
  //      └── Generate button
  //
  //  AFTER GENERATE (standard modes only)
  //  ├── Result box (streamed markdown)
  //  ├── Follow-up suggestion chips
  //  ├── Custom follow-up input
  //  ├── MIDI generating indicator (start/generate modes)
  //  ├── MIDI download cards (full-track or single)
  //  ├── Stereo field panels (stereo mode)
  //  └── DJ Roadmap cards (dj mode)
  //
  //  OVERLAY
  //  └── Guide modal (? button)
  //
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Producer's Toolkit</h1>
            <p className="text-gray-400 mt-1">UK Garage · House · Techno · Speed Garage</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(g => !g)}
              title="How to use Producer's Toolkit"
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold border transition-all ${
                showGuide ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-500 text-gray-400'
              }`}
            >
              ?
            </button>
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

        {/* ── HOME SCREEN — only visible when no mode is active ────────────────
              To reorder tools: move the button blocks around inside this fragment.
              To add a new tool: add to MODES[] array AND add a case in buildPrompt().
              To remove a tool: delete its button block here (MODES[] entry optional).
        ── */}
        
        {!mode && (<>

        {/* Completion Engine — featured full-width */}
        {/*  Start of button ---------------------------------------------------------------*/}
          <button
            onClick={() => { resetCompletionSession(); resetMode('completion') }}
            className="w-full p-5 rounded-xl text-left border border-green-800/50 bg-green-950/20 hover:border-green-600/60 hover:bg-green-950/30 transition-all mb-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg text-green-300">Finish A Song</div>
                <div className="text-sm text-gray-400 mt-0.5">Turn your loop or track into a finished track</div>
              </div>
              <div className="text-right shrink-0 ml-3">

                {/* Conditional check on completion history. 
                    if true then -> finished
                    if false then -> "5 stages" */}
                {/* ---------------------------------------------------------------- */}
                {trackStage != null ? (
                  <>
                    <svg width="80" height="80">
                        {/* background ring — always full, grey */}
                        <circle
                          cx="40" cy="40" r="30"
                          fill="none"
                          stroke="#374151"
                          strokeWidth="8"
                        />
                        {/* foreground ring — green, fills based on progress */}
                        <circle
                          cx="40" cy="40" r="30"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 30}
                          strokeDashoffset={2 * Math.PI * 30 * (1 - STAGE_PROGRESS[trackStage] / 100)}
                          strokeLinecap="round"
                          transform="rotate(-90 40 40)"
                        />
                        <text x="40" y="45" textAnchor="middle" fill="white" fontSize="12">
                          {trackStage.replace('_', ' ')} · {STAGE_PROGRESS[trackStage]}%
                        </text>
                      </svg>
                    <div className="text-xs text-green-500 font-bold">🏆 {trackStage}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-green-700 font-medium">5 stages</div>
                )}
                {/*---------------------------------------------------------------- */}

                <div className="text-2xl opacity-30 mt-0.5">→</div>
              </div>
            </div>
          </button>

          {/* End of button ---------------------------------------------------------------*/}


          <div className="grid grid-cols-2 gap-3 mb-3"> 
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => resetMode(m.id)}
                className={`p-4 rounded-xl text-left border transition-all ${
                  m.id === 'daw' ? 'col-span-2' : ''
                } border-gray-800 bg-gray-900 hover:border-gray-600`}
              >
                <div className="font-semibold mb-0.5">{m.label}</div>
                <div className="text-sm text-gray-400">{m.desc}</div>
              </button>
            ))}
          </div>

          {/* DJ tools */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={() => resetMode('dj')} className="p-4 rounded-xl text-left border border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20 transition-all">
              <div className="font-semibold mb-0.5">🎛️ DJ Roadmap</div>
              <div className="text-sm text-gray-400">Visual journey map to get started</div>
            </button>
            <button onClick={() => resetMode('djset')} className="p-4 rounded-xl text-left border border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20 transition-all">
              <div className="font-semibold mb-0.5">📋 DJ Set Planner</div>
              <div className="text-sm text-gray-400">BPM arc, energy flow & transitions</div>
            </button>
          </div>

          {/* Visual Tools */}
          <button onClick={() => resetMode('visuals')} className="w-full p-5 rounded-xl text-left border border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20 transition-all mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">🎨 Visual Tools & VFX</div>
                <div className="text-sm text-gray-400 mt-0.5">Live visuals, promo content & AI video tools — tailored to your genre and budget</div>
              </div>
              <div className="text-2xl opacity-30">→</div>
            </div>
          </button>

          {/* Release Plan */}
          <button onClick={() => resetMode('release')} className="w-full p-5 rounded-xl text-left border border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20 transition-all mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">🚀 Release Plan</div>
                <div className="text-sm text-gray-400 mt-0.5">Week-by-week rollout — playlists, content plan & Spotify pitch</div>
              </div>
              <div className="text-2xl opacity-30">→</div>
            </div>
          </button>

          
        </>)}

        {/* ── Active mode — back button shown instead of grid ── */}
        {mode && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => resetMode(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
            >
              ← All tools
            </button>
            <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <span className="text-sm font-medium text-purple-300">
                {[...MODES,
                  {id:'dj',         label:'🎛️ DJ Roadmap'},
                  {id:'djset',      label:'📋 DJ Set Planner'},
                  {id:'visuals',    label:'🎨 Visual Tools & VFX'},
                  {id:'release',    label:'🚀 Release Plan'},
                  {id:'stereo',     label:'🌐 Stereo Analyzer'},
                  {id:'completion', label:'✅ Completion Engine'},
                ].find(m => m.id === mode)?.label || mode}
              </span>
            </div>
          </div>
        )}

        {/* ── Completion Engine UI ── */}
        {mode === 'completion' && (
          <div className="space-y-4">

            {/* Progress bar — visible while in stages 1-5 */}
            {completionStage >= 1 && completionStage <= 5 && completionTrack && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white font-semibold truncate max-w-[60%]">{completionTrack.name}</span>
                  <span className="text-xs text-green-500 font-mono font-bold">{completionStage * 20}%</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {[1,2,3,4,5].map(s => (
                    <div key={s} className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                      s < completionStage ? 'bg-green-500' : s === completionStage ? 'bg-purple-500' : 'bg-gray-700'
                    }`} />
                  ))}
                </div>
                <div className="flex justify-between">
                  {COMPLETION_STAGES.map((label, i) => (
                    <span key={label} className={`text-xs font-medium ${
                      i + 1 < completionStage ? 'text-green-500' :
                      i + 1 === completionStage ? 'text-purple-300' : 'text-gray-600'
                    }`}>
                      {i + 1 < completionStage ? '✓ ' : ''}{label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── STAGE 0 — Entry ── */}
            {completionStage === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <h2 className="font-bold text-lg text-white mb-1">✅ Completion Engine</h2>
                  <p className="text-sm text-gray-400 leading-relaxed">Stop restarting. Turn your loop into a finished track — 5 locked stages, one at a time.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Track name</label>
                  <input
                    value={completionTrackName}
                    onChange={e => setCompletionTrackName(e.target.value)}
                    placeholder="e.g. So High, Untitled Loop, Late Night Rough…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-600 text-sm"
                  />
                </div>

                {/* Optional Description of song */}
                <div>
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors mb-2"
                  >
                    + Add description {showDescription ? '▲' : '▼'}
                  </button>
                  {showDescription && (
                    <textarea
                      value={completionInput}
                      onChange={e => setCompletionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBeginCompletion() } }}
                      placeholder="e.g. 4-bar UK garage loop, rolling 808 bassline, Em chord pad, 130 BPM. Got the drop but no arrangement yet. Feels dark and late-night. Keep starting over on this one…"
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-600 resize-none text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Upload loop audio <span className="text-gray-600">(optional — adds real frequency analysis)</span>
                  </label>
                  <input ref={completionFileRef} type="file" accept="audio/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files[0]
                      if (!f) return
                      setCompletionFile(f)
                      try { const a = await analyzeAudioFile(f); setCompletionAnalysis(a) } catch {}
                    }}
                  />
                  <button
                    onClick={() => completionFileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={async e => {
                      e.preventDefault()
                      setIsDragging(false)
                      const f = e.dataTransfer.files[0]
                      if (!f) return
                      setCompletionFile(f)
                      try { const a = await analyzeAudioFile(f); setCompletionAnalysis(a) } catch {}
                    }}
                    className={`w-full p-3 rounded-xl border-2 border-dashed transition-colors text-center ${
                      isDragging ? 'border-green-400 bg-green-950/30' :
                      completionFile ? 'border-green-600/60 bg-green-950/20' :
                      'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    {completionFile
                      ? <span className="text-green-400 text-sm font-medium">{completionFile.name} ✓</span>
                      : <span className="text-gray-500 text-sm">{isDragging ? 'Drop it 🎵' : 'Click or drag to upload (MP3, WAV)'}</span>
                    }
                  </button>
                  {/* audio playback handled by floating player below */}
                </div>

                <div>
                  {/*stage 1 - Sound Design*/ }
                  <button onClick={() => setTrackStage('sound_design')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      trackStage === 'sound_design' ? 'border-green-500 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                   Sound Design · 25%
                  </button>

                  {/*stage 2 - Composition */ }
                  <button onClick={() => setTrackStage('composition')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      trackStage === 'composition' ? 'border-green-500 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    Composition · 50%
                  </button>

                  {/*stage 3 - Mixing */ }
                  <button onClick={() => setTrackStage('mixing')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      trackStage === 'mixing'? 'border-green-500 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    Mixing · 75%
                  </button>

                  {/* Stage 4 Mastering - */ }
                  <button onClick={() => setTrackStage('mastering')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      trackStage === 'mastering' ? 'border-green-500 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    Mastering · 100%
                  </button>
                </div>

                {completionError && (
                  <div className="text-red-400 text-sm text-center py-2">{completionError}</div>
                )}

                <button
                  onClick={handleBeginCompletion}
                  className="w-full py-3 bg-green-700 hover:bg-green-600 rounded-xl font-bold text-white transition-all"
                >
                  Begin Stage 1 →
                </button>

                {/* Finished songs list */}
                {completionHistory.length > 0 && (
                  <div className="pt-3 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        🏆 Finished Songs ({completionHistory.length})
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={historySearch}
                          onChange={e => setHistorySearch(e.target.value)}
                          placeholder="Search…"
                          className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-600 w-32"
                        />
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {completionHistory
                        .filter(t => !historySearch || t.name.toLowerCase().includes(historySearch.toLowerCase()))
                        .map(t => (
                        <div key={t.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 group">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-white">{t.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{t.key} · {t.bpm} BPM</span>
                            {t.vibe && <span className="text-xs text-gray-600 ml-1">· {t.vibe}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-green-500">{t.dateFinished}</span>
                            <button
                              onClick={() => handleDeleteTrack(t.id)}
                              className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs leading-none"
                              title="Delete"
                            >✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STAGE 1 — Idea Lock-In ── */}
            {completionStage === 1 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Stage 1</span>
                    <h3 className="font-bold text-white">Idea Lock-In</h3>
                  </div>
                  <p className="text-xs text-gray-500">Commit to one idea. Stop restarting.</p>
                </div>

                {completionLoading && (
                  <div className="flex items-center gap-3 text-gray-400 text-sm py-6 justify-center">
                    <span className="animate-spin text-xl">⏳</span>
                    <span>Analysing your loop…</span>
                  </div>
                )}

                {!completionLoading && completionTrack && (
                  <div className="space-y-3">
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
                      <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">This is your track</div>
                      <p className="text-white font-medium leading-relaxed text-sm">{completionTrack.commitment}</p>
                      <div className="flex gap-3 mt-3 flex-wrap">
                        <div className="bg-purple-900/30 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span>🥁</span>
                          <div>
                            <div className="text-xs text-gray-500">BPM</div>
                            <div className="text-sm font-bold text-purple-300">{completionTrack.bpm}</div>
                          </div>
                        </div>
                        <div className="bg-purple-900/30 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span>🎹</span>
                          <div>
                            <div className="text-xs text-gray-500">Key</div>
                            <div className="text-sm font-bold text-purple-300">{completionTrack.key}</div>
                          </div>
                        </div>
                        <div className="bg-purple-900/30 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span>🌡️</span>
                          <div>
                            <div className="text-xs text-gray-500">Vibe</div>
                            <div className="text-sm font-bold text-purple-300">{completionTrack.vibe}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {completionTrack.direction && (
                      <div className="bg-gray-800 rounded-xl p-4">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Why this is worth finishing</div>
                        <p className="text-sm text-gray-300 leading-relaxed">{completionTrack.direction}</p>
                      </div>
                    )}
                    <button
                      onClick={handleLockIn}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                    >
                      🔒 Lock This In → Stage 2
                    </button>
                    <p className="text-xs text-gray-600 text-center">Once locked, the idea is final. No going back.</p>
                  </div>
                )}

                {!completionLoading && !completionTrack && completionResult && (
                  <div className="space-y-3">
                    <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">{completionResult}</div>
                    <p className="text-xs text-red-400">Couldn't parse response — go back and try again.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STAGE 2 — Structure Builder ── */}
            {completionStage === 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Stage 2</span>
                    <h3 className="font-bold text-white">Structure Builder</h3>
                  </div>
                  <p className="text-xs text-gray-500">Turn your loop into a full arrangement skeleton.</p>
                </div>

                {!completionResult && !completionLoading && (
                  <button
                    onClick={handleGenerateStructure}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                  >
                    📐 Generate My Structure
                  </button>
                )}

                {completionLoading && (
                  <div className="flex items-center gap-3 text-gray-400 text-sm py-6 justify-center">
                    <span className="animate-spin text-xl">⏳</span>
                    <span>Building your arrangement…</span>
                  </div>
                )}

                {completionResult && !completionLoading && (
                  <div className="space-y-3">
                    {completionTrack?.structure && (() => {
                      const SECTION_ICONS = {
                        intro: { icon: '🌅', color: 'border-blue-700/40 bg-blue-900/20', label: 'text-blue-300' },
                        build: { icon: '📈', color: 'border-yellow-700/40 bg-yellow-900/20', label: 'text-yellow-300' },
                        drop: { icon: '💥', color: 'border-red-700/40 bg-red-900/20', label: 'text-red-300' },
                        breakdown: { icon: '🌊', color: 'border-cyan-700/40 bg-cyan-900/20', label: 'text-cyan-300' },
                        bridge: { icon: '🌉', color: 'border-indigo-700/40 bg-indigo-900/20', label: 'text-indigo-300' },
                        outro: { icon: '🌙', color: 'border-gray-600/40 bg-gray-800/60', label: 'text-gray-400' },
                        verse: { icon: '📝', color: 'border-green-700/40 bg-green-900/20', label: 'text-green-300' },
                        chorus: { icon: '🎤', color: 'border-pink-700/40 bg-pink-900/20', label: 'text-pink-300' },
                        total: { icon: '⏱️', color: 'border-purple-700/40 bg-purple-900/20', label: 'text-purple-300' },
                      }
                      const lines = completionTrack.structure.split('\n').filter(l => l.trim())
                      return (
                        <div>
                          <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">Arrangement</div>
                          <div className="space-y-2">
                            {lines.map((line, i) => {
                              const colonIdx = line.indexOf(':')
                              if (colonIdx === -1) return <p key={i} className="text-xs text-gray-500">{line}</p>
                              const sectionName = line.slice(0, colonIdx).trim()
                              const detail = line.slice(colonIdx + 1).trim()
                              const key = sectionName.toLowerCase().replace(/\s+\d+$/, '').replace(/drop \d/i, 'drop')
                              const style = SECTION_ICONS[key] || { icon: '🎵', color: 'border-gray-700 bg-gray-800', label: 'text-gray-300' }
                              return (
                                <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${style.color}`}>
                                  <span className="text-lg mt-0.5">{style.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold uppercase tracking-wider ${style.label}`}>{sectionName}</div>
                                    <div className="text-sm text-gray-300 mt-0.5 leading-snug">{detail}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                    {completionTrack?.structureTips && (() => {
                      const TIP_ICONS = ['🎛️', '🔊', '🎚️']
                      const TIP_COLORS = [
                        'border-purple-700/40 bg-purple-900/20',
                        'border-blue-700/40 bg-blue-900/20',
                        'border-green-700/40 bg-green-900/20',
                      ]
                      // split on "1." / "2." / "3." at start of a segment
                      const raw = completionTrack.structureTips
                      const tipLines = raw.split(/(?=\d+\.\s+\*\*)|(?=\d+\.\s+[A-Z])/).filter(t => t.trim())
                      return (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">FL Studio Tips</div>
                          <div className="space-y-2">
                            {tipLines.map((tip, i) => {
                              // strip leading "1. " number
                              const clean = tip.replace(/^\d+\.\s*/, '')
                              // pull out bold title if present: **Title**: rest
                              const titleMatch = clean.match(/^\*\*(.+?)\*\*[:\s–-]*(.*)$/s)
                              const title = titleMatch ? titleMatch[1] : null
                              const body  = titleMatch ? titleMatch[2].trim() : clean.trim()
                              return (
                                <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${TIP_COLORS[i] || 'border-gray-700 bg-gray-800'}`}>
                                  <span className="text-lg mt-0.5">{TIP_ICONS[i] || '💡'}</span>
                                  <div>
                                    {title && <div className="text-xs font-bold text-white uppercase tracking-wide mb-1">{title}</div>}
                                    <p className="text-sm text-gray-300 leading-relaxed">{body}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                    <button
                      onClick={handleConfirmStructure}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                    >
                      ✓ Confirm Structure → Stage 3
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STAGE 3 — Forced Decisions ── */}
            {completionStage === 3 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Stage 3</span>
                    <h3 className="font-bold text-white">Forced Decisions</h3>
                  </div>
                  <p className="text-xs text-gray-500">3 decisions. One at a time. No going back once picked.</p>
                </div>

                {/* Locked decisions log */}
                {completionDecisions.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Decisions locked</div>
                    {completionDecisions.map((d, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-green-400">
                        <span className="shrink-0 mt-0.5">✓</span><span>{d}</span>
                      </div>
                    ))}
                  </div>
                )}

                {completionDecisionOptions.length === 0 && !completionLoading && !completionResult && (
                  <button
                    onClick={handleGetDecisions}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                  >
                    ⚡ Get My 3 Decisions
                  </button>
                )}

                {completionLoading && (
                  <div className="flex items-center gap-3 text-gray-400 text-sm py-6 justify-center">
                    <span className="animate-spin text-xl">⏳</span>
                    <span>Generating your decisions…</span>
                  </div>
                )}

                {completionResult && !completionLoading && completionDecisionOptions.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400">{completionResult}</p>
                    <button onClick={handleGetDecisions} className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-semibold transition-all">Try Again</button>
                  </div>
                )}

                {/* Decision cards — all shown at once, all optional */}
                {completionDecisionOptions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Pick any you want — all optional. Run Feedback when ready.</p>
                    {completionDecisionOptions.map((opt, i) => (
                      <div key={i} className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
                        <p className="text-sm font-semibold text-yellow-100 mb-3 leading-snug">{opt.question}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ label: opt.optionA, side: 'A' }, { label: opt.optionB, side: 'B' }].map(({ label, side }) => {
                            const isRec = opt.recommended === side
                            const isPicked = completionDecisionPicks[i] === label
                            return (
                              <button
                                key={side}
                                onClick={() => setCompletionDecisionPicks(p => ({ ...p, [i]: p[i] === label ? null : label }))}
                                className={`relative p-3 border rounded-xl text-sm font-medium text-left transition-all leading-snug ${
                                  isPicked
                                    ? side === 'A' ? 'bg-purple-600/60 border-purple-400 text-white' : 'bg-blue-600/60 border-blue-400 text-white'
                                    : side === 'A' ? 'bg-purple-700/20 hover:bg-purple-600/40 border-purple-500/30 text-gray-300' : 'bg-blue-700/20 hover:bg-blue-600/40 border-blue-500/30 text-gray-300'
                                }`}
                              >
                                {isRec && (
                                  <span className="absolute -top-2 left-2 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">AI pick</span>
                                )}
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleCommitDecisions}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                    >
                      🎯 Run Feedback Pass →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STAGE 4 — Feedback Pass ── */}
            {completionStage === 4 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Stage 4</span>
                    <h3 className="font-bold text-white">Feedback Pass</h3>
                  </div>
                  <p className="text-xs text-gray-500">3 critical fixes — ranked by importance. No more, no less.</p>
                </div>

                {/* Decision log */}
                {completionDecisions.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Your decisions</div>
                    {completionDecisions.map((d, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-gray-400 mb-0.5">
                        <span className="text-green-500 shrink-0">✓</span><span>{d}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!completionResult && !completionLoading && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">
                        Notes on your current draft <span className="text-gray-600">(optional)</span>
                      </label>
                      <textarea
                        value={completionInput}
                        onChange={e => setCompletionInput(e.target.value)}
                        placeholder="e.g. Drop sounds right, breakdown feels thin, build has no tension, outro is too long…"
                        rows={2}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none text-sm"
                      />
                    </div>
                    <button
                      onClick={handleGetFeedback}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                    >
                      🎯 Run Feedback Pass
                    </button>
                  </>
                )}

                {completionLoading && (
                  <div className="flex items-center gap-3 text-gray-400 text-sm py-6 justify-center">
                    <span className="animate-spin text-xl">⏳</span>
                    <span>Finding your 3 critical fixes…</span>
                  </div>
                )}

                {completionResult && !completionLoading && (
                  <div className="space-y-3">
                    {completionTrack?.feedback && completionTrack.feedback.length > 0 ? (
                      <>
                        {completionTrack.feedback.map((item, i) => {
                          const text = item.toLowerCase()
                          const prodIcon =
                            text.includes('kick')                          ? '🥁' :
                            text.includes('bass') || text.includes('808') ? '🎸' :
                            text.includes('synth') || text.includes('pad') || text.includes('chord') ? '🎹' :
                            text.includes('vocal') || text.includes('vox') ? '🎤' :
                            text.includes('hi-hat') || text.includes('hihat') || text.includes('hat') ? '🔔' :
                            text.includes('snare') || text.includes('clap')  ? '👏' :
                            text.includes('reverb') || text.includes('delay') || text.includes('fx') ? '🌊' :
                            text.includes('mix') || text.includes('eq') || text.includes('compress') ? '🎚️' :
                            text.includes('master') || text.includes('loud') ? '📻' :
                            text.includes('arrangement') || text.includes('structure') || text.includes('section') ? '🗺️' :
                            i === 0 ? '🔴' : i === 1 ? '🟡' : '⚪'
                          return (
                            <div key={i} className={`rounded-xl p-4 border ${
                              i === 0 ? 'bg-red-900/20 border-red-700/40' :
                              i === 1 ? 'bg-yellow-900/20 border-yellow-700/40' :
                                        'bg-gray-800 border-gray-700'
                            }`}>
                              <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
                                i === 0 ? 'text-red-400' : i === 1 ? 'text-yellow-400' : 'text-gray-400'
                              }`}>
                                <span>{prodIcon}</span>
                                {i === 0 ? 'Critical fix' : i === 1 ? 'Important fix' : 'Nice to have'}
                              </div>
                              <p className="text-sm text-white leading-relaxed">{item}</p>
                            </div>
                          )
                        })}
                        <button
                          onClick={handleMoveToExport}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                        >
                          ✓ Addressed (or noted) → Stage 5: Export
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">{completionResult}</div>
                        <button
                          onClick={handleMoveToExport}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                        >
                          → Stage 5: Export
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── STAGE 5 — Export Mode ── */}
            {completionStage === 5 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-green-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Stage 5</span>
                    <h3 className="font-bold text-white">Export Mode</h3>
                  </div>
                  <p className="text-xs text-gray-500">Stop tweaking. Tick all 5. Ship it.</p>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3">
                  <p className="text-xs text-yellow-400 font-medium">
                    🔒 Export Mode is locked — no new elements. This track is done. Tick every box and mark it finished.
                  </p>
                </div>

                <div className="space-y-2">
                  {EXPORT_CHECKLIST.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleChecklistToggle(i)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        completionChecklist[i]
                          ? 'border-green-600/50 bg-green-900/20'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        completionChecklist[i] ? 'border-green-500 bg-green-500' : 'border-gray-600'
                      }`}>
                        {completionChecklist[i] && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <span className={`text-sm ${completionChecklist[i] ? 'text-green-300' : 'text-gray-300'}`}>{item}</span>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-gray-600 text-center">
                  {completionChecklist.filter(Boolean).length} / {EXPORT_CHECKLIST.length} checked
                </div>

                <button
                  onClick={handleMarkFinished}
                  disabled={!completionChecklist.every(Boolean)}
                  className="w-full py-4 bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-lg text-white transition-all"
                >
                  🏆 Mark as FINISHED
                </button>
              </div>
            )}

            {/* ── STAGE 6 — Celebration ── */}
            {completionStage === 6 && (
              <div className="bg-gray-900 border border-green-700/40 rounded-xl p-6 text-center space-y-4">
                <div className="text-6xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-bold text-green-400">Track Finished.</h2>
                  <p className="text-gray-400 mt-1 font-medium">{completionTrack?.name}</p>
                  {completionTrack && (
                    <p className="text-sm text-gray-500 mt-1">
                      {completionTrack.key} · {completionTrack.bpm} BPM{completionTrack.vibe ? ` · ${completionTrack.vibe}` : ''}
                    </p>
                  )}
                </div>

                <div className="bg-gray-800 rounded-xl p-4 text-left">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    🏆 Finished Songs ({completionHistory.length})
                  </div>
                  <div className="space-y-2">
                    {completionHistory.slice(0, 6).map(t => (
                      <div key={t.id} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-white">{t.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{t.key} · {t.bpm} BPM</span>
                        </div>
                        <span className="text-xs text-green-500 shrink-0 ml-2">{t.dateFinished}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCompletionNewTrack}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all"
                >
                  + Start Another Track
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── Input panel ── */}
        {mode && mode !== 'completion' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">

            {/* Start From Nothing — chord type + options */}
            {mode === 'start' && (
              <>
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
                <p className="text-xs text-gray-500">
                  🎹 Generates <strong className="text-gray-300">chords + melody + bass MIDI</strong> in one go — drag all 3 into FL Studio and you have a full arrangement skeleton.
                </p>
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
                <div className="flex items-center gap-3">
                  <button onClick={() => setPedalNote(b => !b)}
                    className={`relative w-10 h-5 rounded-full border transition-colors shrink-0 ${
                      pedalNote ? 'bg-purple-600 border-purple-500' : 'bg-gray-700 border-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${pedalNote ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-gray-300">
                    🎵 Pedal Note Bass
                    <span className="text-gray-500 text-xs ml-1.5">root note drones while harmony moves — UK garage / deep house</span>
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

            {/* DJ Set Planner — event selectors */}
            {mode === 'djset' && (
              <div className="space-y-3">
                {/* Starter templates for new users */}
                {!input && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">New to set planning? Start here ↓</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        {
                          icon: '🎛️',
                          label: 'First ever DJ set',
                          event: 'House Party',
                          duration: '1 hour',
                          energy: 'Slow build to peak',
                          prompt: 'This is my first time planning a DJ set. I play UK garage and speed garage. Mixed crowd, some who know the genre and some who don\'t. Want to ease them in then go harder.',
                        },
                        {
                          icon: '🏟️',
                          label: 'Club night set',
                          event: 'Club Night',
                          duration: '2 hours',
                          energy: 'Slow build to peak',
                          prompt: 'Peak time club set. UK garage, speed garage and some house. Crowd who knows the music. Want to build steadily then go hard in the second half.',
                        },
                        {
                          icon: '🎪',
                          label: 'Festival warm-up',
                          event: 'Festival Stage',
                          duration: '1 hour',
                          energy: 'Slow build to peak',
                          prompt: 'Warm-up slot at a festival. Small crowd early on, growing as I play. Need to set the mood without going too hard too early. House and garage vibes.',
                        },
                        {
                          icon: '🏠',
                          label: 'House party all night',
                          event: 'House Party',
                          duration: '3 hours',
                          energy: 'Peaks and valleys',
                          prompt: 'Playing a house party all night. Diverse crowd, mix of ages. Want it to feel like a proper night out — peaks, valleys, crowd reading, nothing too intense.',
                        },
                      ].map(t => (
                        <button
                          key={t.label}
                          onClick={() => {
                            setInput(t.prompt)
                            setDjSetEvent(t.event)
                            setDjSetDuration(t.duration)
                            setDjSetEnergy(t.energy)
                          }}
                          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-600 rounded-xl p-3 text-left transition-all group"
                        >
                          <div className="text-lg mb-1">{t.icon}</div>
                          <div className="text-xs font-medium text-gray-200 group-hover:text-white">{t.label}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{t.event} · {t.duration}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Event type</label>
                  <div className="flex flex-wrap gap-2">
                    {['Club Night', 'House Party', 'Festival Stage', 'Private Event', 'Online Stream', 'Warm-up Set', 'Closing Set'].map(t => (
                      <button key={t}
                        onClick={() => setDjSetEvent(t)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          djSetEvent === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                          : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Set duration</label>
                  <div className="flex gap-2">
                    {['30 min', '1 hour', '1.5 hours', '2 hours', '3 hours', '4+ hours'].map(t => (
                      <button key={t}
                        onClick={() => setDjSetDuration(t)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          djSetDuration === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                             : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Energy arc</label>
                  <div className="flex gap-2">
                    {['Slow build to peak', 'Peak time from start', 'Peaks and valleys', 'Gradual cool down'].map(t => (
                      <button key={t}
                        onClick={() => setDjSetEnergy(t)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          djSetEnergy === t ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                           : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Visual Tools — starter templates */}
            {mode === 'visuals' && !input && (
              <div>
                <label className="block text-xs text-gray-400 mb-2">Quick start — tap a scenario or describe your own below</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      icon: '🎭',
                      label: 'Live set visuals — no experience',
                      prompt: 'I perform dark techno/UK garage live sets at small clubs. Complete beginner with visuals, budget under £100. I want something that reacts to my music in real time.',
                      preview: 'Gets: Resolume Avenue vs VDMX comparison, free alternatives like Milkdrop, step-by-step setup guide, what gear you need to connect to a projector.',
                    },
                    {
                      icon: '📱',
                      label: 'Social content & reels',
                      prompt: 'I make house and speed garage. I want to create high-quality Instagram reels and TikToks to promote my tracks. No film crew, mostly self-produced on a budget.',
                      preview: 'Gets: AI video tools like Runway and Sora, free options like CapCut, how to turn your waveform into content, visual style ideas that match your genre.',
                    },
                    {
                      icon: '🎥',
                      label: 'Music video on zero budget',
                      prompt: 'I want to make a music video for a UK garage track. Zero budget, just me and a phone. Want it to look intentional and aesthetic, not cheap.',
                      preview: 'Gets: phone cinematography tips, free editing tools, AI-generated visual ideas, references from artists who pull it off with low budgets.',
                    },
                    {
                      icon: '🖼️',
                      label: 'Album artwork & brand visuals',
                      prompt: 'I need artwork for an EP release and consistent visual branding for my artist identity. Dark, minimal aesthetic. Don\'t want it to look like generic AI art.',
                      preview: 'Gets: AI image tools with the right prompting approach, Midjourney vs Adobe Firefly comparison, how to make AI art look intentional, branding tips.',
                    },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={() => setInput(t.prompt)}
                      className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-600 rounded-xl p-3 text-left transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">{t.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-200 group-hover:text-white">{t.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-400">{t.preview}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DAW & Learning — sub-mode selector */}
            {mode === 'daw' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">What do you need?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDawMode('setup')}
                    className={`flex-1 p-3 rounded-xl text-sm border transition-all text-left ${
                      dawMode === 'setup' ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                         : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                    }`}
                  >
                    <div className="font-semibold">🔰 Setup Guide</div>
                    <div className="text-xs opacity-70 mt-0.5">Gear, plugins & first steps</div>
                  </button>
                  <button
                    onClick={() => setDawMode('transition')}
                    className={`flex-1 p-3 rounded-xl text-sm border transition-all text-left ${
                      dawMode === 'transition' ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                              : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                    }`}
                  >
                    <div className="font-semibold">🔄 DAW Switch</div>
                    <div className="text-xs opacity-70 mt-0.5">Move from one DAW to another</div>
                  </button>
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

            {/* Stereo Field Analyzer — file upload + band analysis */}
            {mode === 'stereo' ? (
              <div className="space-y-3">
                <input ref={stereoFileRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => handleStereoFileSelect(e.target.files[0])} />
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Genre / Context <span className="text-gray-600">(optional — helps the AI map instruments)</span></label>
                  <input
                    value={stereoGenre}
                    onChange={e => setStereoGenre(e.target.value)}
                    placeholder="e.g. UK garage, dark techno, speed garage, house…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Upload your mix / track</label>
                  <button
                    onClick={() => stereoFileRef.current?.click()}
                    className={`w-full p-4 rounded-xl border-2 border-dashed transition-colors text-center ${
                      stereoFile ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                    }`}
                  >
                    {stereoFile ? (
                      <div>
                        <div className="text-purple-300 font-medium">{stereoFile.name}</div>
                        <div className="text-gray-500 text-xs mt-1">Click to change file</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl mb-2">🔊</div>
                        <div className="text-gray-400 text-sm">Click to upload your track</div>
                        <div className="text-gray-600 text-xs mt-1">MP3, WAV, AIFF, etc.</div>
                      </div>
                    )}
                  </button>
                </div>
                {analysingStereo && (
                  <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Analysing stereo field…
                  </div>
                )}
                {stereoError && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{stereoError}</div>
                )}
                {stereoAnalysis && !analysingStereo && (
                  <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-3">
                    <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Stereo Field Measurements</div>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-gray-500">Duration</span><br/><span className="text-gray-200 font-medium">{stereoAnalysis.duration}s</span></div>
                      <div><span className="text-gray-500">Width</span><br/><span className="text-gray-200 font-medium">{stereoAnalysis.overallWidth}%</span></div>
                      <div><span className="text-gray-500">Format</span><br/><span className="text-gray-200 font-medium">{stereoAnalysis.isMono ? 'Mono' : 'Stereo'}</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Per-band stereo position (L ← center → R)</div>
                      <div className="space-y-1.5">
                        {stereoAnalysis.bandData.map(b => (
                          <div key={b.name} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 w-20 shrink-0">{b.name}</span>
                            <div className="flex-1 relative bg-gray-700 rounded-full h-2">
                              <div className="absolute left-1/2 top-0 w-px h-full bg-gray-500 opacity-60"/>
                              <div
                                className={`absolute top-0 h-full rounded-full transition-all ${b.pan < -5 ? 'bg-blue-400' : b.pan > 5 ? 'bg-orange-400' : 'bg-purple-400'}`}
                                style={{ width: Math.max(2, Math.abs(b.pan) / 2) + '%', left: b.pan < 0 ? (50 + b.pan / 2) + '%' : '50%' }}
                              />
                            </div>
                            <span className="text-gray-400 w-10 text-right font-mono text-xs">
                              {b.pan > 0 ? '+' : ''}{b.pan}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  🌐 Analyses L/R frequency content across 7 bands, then maps each band to an instrument and plots it on a 3D stereo field — side by side with the ideal layout for your genre.
                </p>
              </div>
            ) : /* Analyse Sample — file upload + real analysis */
            mode === 'sample' ? (
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
                  mode === 'daw' && dawMode === 'setup'      ? 'e.g. Complete beginner, budget around £500, want to make house music, have a laptop...' :
                  mode === 'daw' && dawMode === 'transition' ? 'e.g. Been on FL Studio for 3 years, want to move to Ableton Live, I make UK garage...' :
                  mode === 'dj'         ? 'e.g. I already produce house music, want to learn to DJ my own tracks, budget £300...' :
                  mode === 'djset'      ? 'e.g. UK garage and speed garage, crowd will be 200 people who know the genre, want to go hard...' :
                  mode === 'visuals'    ? 'e.g. I make dark techno, want visuals for live sets and Instagram reels, beginner with no budget...' :
                  mode === 'vocals'     ? 'e.g. I record at home, no vocal booth, FL Studio, I have Pro-Q 3 and a few Waves plugins. Want a professional upfront sound...' :
                  mode === 'master'     ? 'e.g. Making UK garage at 130 BPM, want it loud and wide enough for clubs, using FL Studio, have Ozone 8 and FabFilter...' :
                  'Tell me more…'
                }
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            )}

            {/* Generate Track — helper note */}
            {mode === 'generate' && (
              <p className="text-xs text-gray-500">
                💡 Generates a Suno/Udio prompt <strong className="text-gray-400">+</strong> chords, melody & bass MIDI files <strong className="text-gray-400">+</strong> FL Studio instrument guide — all in one hit. Suno free tier at <span className="text-purple-400">suno.com</span>.
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

        {/* ── Result — sits right below the Generate button ── */}
        {mode !== 'completion' && (result || loading) && (
          <div ref={resultRef} className="space-y-3 mt-2">
            {/* Loading placeholder */}
            {loading && !result && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center gap-3">
                <span className="animate-spin text-xl">⏳</span>
                <span className="text-gray-400">{loadingMsg}</span>
              </div>
            )}
            {/* Result box */}
            {result && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 prose prose-invert max-w-none relative">
                <button
                  onClick={handleCopy}
                  className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-all border border-gray-700"
                >
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}
            {/* Follow-up suggestions */}
            {!loading && mode && (FOLLOW_UPS[mode === 'daw' ? (dawMode === 'transition' ? 'transition' : 'daw') : mode]) && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 px-1">Follow up:</p>
                <div className="flex flex-wrap gap-2">
                  {(FOLLOW_UPS[mode === 'daw' ? (dawMode === 'transition' ? 'transition' : 'daw') : mode] || []).map((suggestion) => (
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

        {/* ── MIDI generating indicator ── */}
        {generatingMidi && !midiData && (
          <div className="mb-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl flex items-center gap-3">
            <span className="animate-spin text-lg">🎹</span>
            <div>
              <div className="text-sm font-medium text-purple-300">Generating MIDI files…</div>
              <div className="text-xs text-gray-500 mt-0.5">Building chords, melody & bassline from your track brief</div>
            </div>
          </div>
        )}

        {/* ── MIDI download — full-track (3 files) ── */}
        {midiData?.isFullTrack && (
          <div className="mb-4 bg-purple-900/20 border border-purple-500/30 rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="font-semibold text-purple-300 mb-1">🎼 Full Track MIDI Ready</div>
              <p className="text-xs text-gray-400">Drag each file into its own FL Studio channel. Layer them and you've got a full arrangement skeleton.</p>
            </div>

            {/* 3 download buttons */}
            <div className="px-4 pb-3 grid grid-cols-3 gap-2 mt-2">
              {midiData.chord && (
                <a
                  href={midiData.chord.uri}
                  download={`chords_${midiData.chord.notes.join('-')}_${midiData.chord.bpm}bpm.mid`}
                  className="flex flex-col items-center gap-1 p-3 bg-purple-700/40 hover:bg-purple-700/60 border border-purple-600/40 rounded-xl text-center transition-all"
                >
                  <span className="text-xl">🎹</span>
                  <span className="text-xs font-semibold text-purple-200">Chords</span>
                  <span className="text-xs text-gray-400">{midiData.chord.notes.join('-')}</span>
                  <span className="text-xs text-gray-500">{midiData.chord.bpm} BPM</span>
                </a>
              )}
              {midiData.melody && (
                <a
                  href={midiData.melody.uri}
                  download={`melody_${midiData.melody.notes.join('-')}_${midiData.melody.bpm}bpm.mid`}
                  className="flex flex-col items-center gap-1 p-3 bg-blue-700/30 hover:bg-blue-700/50 border border-blue-600/40 rounded-xl text-center transition-all"
                >
                  <span className="text-xl">🎵</span>
                  <span className="text-xs font-semibold text-blue-200">Melody</span>
                  <span className="text-xs text-gray-400 break-all">{midiData.melody.notes.slice(0,4).join('-')}…</span>
                  <span className="text-xs text-gray-500">{midiData.melody.bpm} BPM</span>
                </a>
              )}
              {midiData.bass && (
                <a
                  href={midiData.bass.uri}
                  download={`bass_${midiData.bass.notes.join('-')}_${midiData.bass.bpm}bpm.mid`}
                  className="flex flex-col items-center gap-1 p-3 bg-green-700/30 hover:bg-green-700/50 border border-green-600/40 rounded-xl text-center transition-all"
                >
                  <span className="text-xl">🔉</span>
                  <span className="text-xs font-semibold text-green-200">Bass</span>
                  <span className="text-xs text-gray-400 break-all">{midiData.bass.notes.slice(0,4).join('-')}…</span>
                  <span className="text-xs text-gray-500">{midiData.bass.bpm} BPM</span>
                </a>
              )}
            </div>

            {/* Instrument guide */}
            {midiData.instruments && Object.keys(midiData.instruments).length > 0 && (
              <div className="mx-4 mb-3 p-3 bg-gray-900/60 rounded-lg">
                <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">🎛️ Load These in FL Studio</div>
                <div className="space-y-1.5">
                  {Object.entries(midiData.instruments).map(([part, plugin]) => (
                    <div key={part} className="flex gap-2 text-xs">
                      <span className="text-gray-500 w-14 shrink-0 capitalize">{part}</span>
                      <span className="text-gray-200">→ {plugin}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mixer layout */}
            {midiData.mixer && midiData.mixer.length > 0 && (
              <div className="mx-4 mb-4 p-3 bg-gray-900/60 rounded-lg">
                <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">🎚️ FL Studio Mixer Setup</div>
                <div className="flex gap-1.5 flex-wrap">
                  {midiData.mixer.map(ch => (
                    <div key={ch.ch} className="flex flex-col items-center bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 min-w-[56px]">
                      <span className="text-xs text-gray-500 mb-0.5">Ch{ch.ch}</span>
                      <span className="text-xs text-gray-200 font-medium text-center leading-tight">{ch.label}</span>
                      {ch.detail && <span className="text-xs text-gray-500 text-center mt-0.5 leading-tight">{ch.detail}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MIDI download — single file (other modes) ── */}
        {midiData && !midiData.isFullTrack && (
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

        {/* ── Stereo Field visualization ── */}
        {stereoFieldData && (
          <div className="mb-4 space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider px-1">Stereo Field Map</div>
            <div className="flex gap-3">
              <StereoFieldPanel
                instruments={stereoFieldData.ideal}
                title="✦ Ideal Layout"
                accent="blue"
              />
              <StereoFieldPanel
                instruments={stereoFieldData.actual}
                title="◉ Your Mix"
                accent="purple"
              />
            </div>
            {stereoFieldData.feedback && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
                <div className="text-xs font-semibold text-yellow-400 mb-1 uppercase tracking-wider">Key Fix</div>
                <p className="text-sm text-yellow-200">{stereoFieldData.feedback}</p>
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Instrument Positions</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                {/* Headers */}
                <div className="text-xs text-blue-400 font-semibold pb-1 border-b border-gray-800">Ideal</div>
                <div className="text-xs text-purple-400 font-semibold pb-1 border-b border-gray-800">Your Mix</div>
                {/* Row data */}
                {stereoFieldData.ideal.map((inst, i) => {
                  const actual = stereoFieldData.actual[i]
                  const diff   = actual ? Math.abs(actual.pan - inst.pan) : 0
                  return (
                    <>
                      <div key={`ideal-${i}`} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-xs">
                        <span className="text-gray-300 font-medium">{inst.name}</span>
                        <span className="text-blue-300 font-mono">{inst.pan > 0 ? '+' : ''}{inst.pan} / d{inst.depth}</span>
                      </div>
                      <div key={`actual-${i}`} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 text-xs">
                        <span className="text-gray-300 font-medium">{actual?.name || '—'}</span>
                        <span className={`font-mono ${diff > 30 ? 'text-red-400' : diff > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {actual ? `${actual.pan > 0 ? '+' : ''}${actual.pan} / d${actual.depth}` : '—'}
                        </span>
                      </div>
                    </>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
                <span className="text-green-500">●</span> On target
                <span className="text-yellow-500">●</span> Minor offset
                <span className="text-red-500">●</span> Needs attention
                <span className="ml-auto">pan = L/R · d = depth</span>
              </div>
            </div>
          </div>
        )}

        {/* ── DJ Roadmap visual ── */}
        {djRoadmapData && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">Your DJ Journey</div>
            {/* Horizontal scroll on mobile, full width on desktop */}
            <div className="overflow-x-auto pb-2">
              <div className="flex items-stretch gap-0 min-w-max md:min-w-0 md:grid md:grid-cols-4">
                {djRoadmapData.map((stage, i) => (
                  <div key={stage.num} className="flex items-stretch">
                    {/* Stage card */}
                    <div className={`relative p-4 rounded-xl border w-56 md:w-auto flex flex-col gap-2 ${
                      i === 0 ? 'border-green-600 bg-green-950/30' :
                      i === djRoadmapData.length - 1 ? 'border-purple-500 bg-purple-950/30' :
                      'border-gray-700 bg-gray-900'
                    }`}>
                      {/* Stage number badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-green-600 text-white' :
                        i === djRoadmapData.length - 1 ? 'bg-purple-600 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>{stage.num}</div>
                      <div className="font-semibold text-sm text-white">{stage.title}</div>
                      <div className={`text-xs font-medium px-2 py-0.5 rounded-full self-start ${
                        i === 0 ? 'bg-green-900/50 text-green-300' :
                        i === djRoadmapData.length - 1 ? 'bg-purple-900/50 text-purple-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>{stage.timeframe}</div>
                      <p className="text-xs text-gray-400 leading-relaxed flex-1">{stage.focus}</p>
                      <div className="mt-auto pt-2 border-t border-gray-800">
                        <div className="text-xs text-gray-600 mb-0.5">Gear</div>
                        <div className="text-xs text-gray-300">{stage.gear}</div>
                      </div>
                    </div>
                    {/* Arrow connector */}
                    {i < djRoadmapData.length - 1 && (
                      <div className="flex items-center px-1 shrink-0 text-gray-600 text-lg">›</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>

      {/* ── Guide modal ── */}
      {showGuide && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end p-4 pt-16"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-gray-950 border border-gray-700 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-lg">How to use Producer's Toolkit</h2>
                <p className="text-xs text-gray-500 mt-0.5">Pick a mode, describe your idea, hit Generate</p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Intro */}
            <div className="px-5 py-4 border-b border-gray-800">
              <p className="text-sm text-gray-400 leading-relaxed">
                Producer's Toolkit uses AI to give you real, specific production advice — not generic tips.
                Each mode is designed for a different part of the creative process.
                You don't need to know music theory. Just describe what you're going for in plain English.
              </p>
            </div>

            {/* Mode guides */}
            <div className="divide-y divide-gray-800">
              {GUIDE.map(g => (
                <div key={g.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{g.icon}</span>
                    <h3 className="font-semibold text-white">{g.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3 leading-relaxed">{g.what}</p>
                  <div className="space-y-1.5 mb-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Example prompts</p>
                    {g.examples.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-purple-500 text-xs mt-0.5 shrink-0">→</span>
                        <p className="text-xs text-gray-300 italic">"{ex}"</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-start gap-2">
                    <span className="text-yellow-500 text-xs mt-0.5 shrink-0">💡</span>
                    <p className="text-xs text-gray-400">{g.tip}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-800">
              <p className="text-xs text-gray-600 text-center">
                Click anywhere outside to close · Results improve with more detail
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating audio player ── */}
      {audioUrl && (
        <>
          {/* Hidden actual audio element */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={() => setAudioCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
            onEnded={() => setAudioPlaying(false)}
          />

          {/* Spotify-style bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
            <div
              className="pointer-events-auto border-t border-white/10 shadow-2xl"
              style={{ background: 'rgba(15, 15, 15, 0.98)', backdropFilter: 'blur(32px)' }}
            >
              {/* Seekable scrubber */}
              <div className="max-w-3xl mx-auto px-6 pt-3 pb-1">
                <div
                  className="w-full h-1 bg-white/10 rounded-full cursor-pointer relative group"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    if (audioRef.current) audioRef.current.currentTime = pct * audioDuration
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%`,
                      background: 'linear-gradient(90deg, #1DB954, #1ed760)'
                    }}
                  />
                  {/* Scrub handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5"
                    style={{ left: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-600 font-mono tabular-nums">
                    {Math.floor(audioCurrentTime / 60)}:{String(Math.floor(audioCurrentTime % 60)).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-gray-600 font-mono tabular-nums">
                    -{Math.floor(Math.max(0, audioDuration - audioCurrentTime) / 60)}:{String(Math.floor(Math.max(0, audioDuration - audioCurrentTime) % 60)).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 max-w-3xl mx-auto px-6 pb-3">
                {/* Left: album art + track name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #1DB954 0%, #0a3d1f 100%)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate leading-tight">
                      {completionFile?.name?.replace(/\.[^/.]+$/, '') || 'Track'}
                    </div>
                    <div className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                      {completionTrack ? `${completionTrack.bpm} BPM · ${completionTrack.key} · ${completionTrack.vibe || ''}` : 'Completion Engine'}
                    </div>
                  </div>
                </div>

                {/* Center: play/pause with SVG icons */}
                <div className="shrink-0">
                  <button
                    onClick={() => {
                      if (!audioRef.current) return
                      if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false) }
                      else { audioRef.current.play(); setAudioPlaying(true) }
                    }}
                    className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
                    style={{ background: '#1DB954' }}
                  >
                    {audioPlaying ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="black">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="black">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Right: close */}
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={() => { setAudioUrl(null); setAudioPlaying(false); setCompletionFile(null) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Spacer so content isn't hidden behind the player */}
          <div className="h-24" />
        </>
      )}

    </div>
  )
}
