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
  daw:      ['Thinking...', 'Checking your budget...', 'Building your setup...', 'Picking the right plugins...'],
  transition:['Thinking...', 'Mapping the differences...', 'Comparing workflows...', 'Building your guide...'],  
  dj:       ['Thinking...', 'Building your roadmap...', 'Checking the gear...', 'Mapping the journey...'],
  djset:    ['Thinking...', 'Planning the set...', 'Mapping the energy arc...', 'Sequencing the tracks...'],
  visuals:  ['Thinking...', 'Scanning the tools...', 'Finding the aesthetic...', 'Building your stack...'],
  vocals:   ['Thinking...', 'Building the chain...', 'Setting the gain staging...', 'Tuning the processing...'],
  master:   ['Thinking...', 'Checking the chain...', 'Analysing the headroom...', 'Preparing the master...'],
  release:  ['Thinking...', 'Building the timeline...', 'Finding the right playlists...', 'Mapping the rollout...'],
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
  { id: 'lyrics',   label: '✍️ Lyric Concepts',     desc: 'Raw themes, not cheesy AI' },
  { id: 'sounds',   label: '🎧 Sound Discovery',    desc: 'Beyond Splice'             },
  { id: 'mix',      label: '🎚️ Mix Advice',         desc: 'Surgical EQ & plugin tips' },
  { id: 'design',   label: '🔊 Sound Design',       desc: 'Recreate any sound'        },
  { id: 'generate', label: '🎵 Generate Track',     desc: 'Suno/Udio prompt + brief'  },
  { id: 'sample',   label: '🎙️ Analyze Sample',     desc: 'Upload audio for real analysis' },
  { id: 'daw',       label: '🖥️ DAW & Learning',     desc: 'Setup, gear & switching DAWs' },
  { id: 'vocals',    label: '🎤 Vocal Chain',         desc: 'Pro chain from a working producer' },
  { id: 'master',   label: '🎛️ Master Chain',        desc: 'Full mastering chain breakdown' },
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
    .replace(/STAGE\[\d+\]:[^\n]+/g, '')
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
const buildPrompt = ({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis, dawMode, djSetEvent, djSetDuration, djSetEnergy }) => {
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
  const [mode, setMode] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [dawMode, setDawMode] = useState('setup') // 'setup' | 'transition'
  const [djRoadmapData, setDjRoadmapData] = useState(null)
  const [djSetEvent, setDjSetEvent] = useState('Club Night')
  const [djSetDuration, setDjSetDuration] = useState('2 hours')
  const [djSetEnergy, setDjSetEnergy] = useState('Slow build to peak')
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
    setDjRoadmapData(null)
    setCopied(false)
    let accumulated = ''
    try {
      await callAI(messages, (chunk) => {
        accumulated += chunk
        setResult(accumulated)
      })
      const parsed  = parseMidiLine(accumulated)
      const djStages = parseDJRoadmap(accumulated)
      const cleaned = cleanResult(accumulated)
      setResult(cleaned)
      if (djStages) setDjRoadmapData(djStages)
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
    const prompt   = buildPrompt({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc, sampleAnalysis, dawMode, djSetEvent, djSetDuration, djSetEnergy })
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
    setConversationHistory([]); setFollowUpInput(''); setDjRoadmapData(null)
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

        {/* ── Mode grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => resetMode(m.id)}
              className={`p-4 rounded-xl text-left border transition-all ${
                m.id === 'daw' || m.id === 'release' ? 'col-span-2' : ''
              } ${
                mode === m.id ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-800 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="font-semibold mb-0.5">{m.label}</div>
              <div className="text-sm text-gray-400">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* ── DJ tools — side by side ── */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => resetMode('dj')}
            className={`p-4 rounded-xl text-left border transition-all ${
              mode === 'dj'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20'
            }`}
          >
            <div className="font-semibold mb-0.5">🎛️ DJ Roadmap</div>
            <div className="text-sm text-gray-400">Visual journey map to get started</div>
          </button>
          <button
            onClick={() => resetMode('djset')}
            className={`p-4 rounded-xl text-left border transition-all ${
              mode === 'djset'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20'
            }`}
          >
            <div className="font-semibold mb-0.5">📋 DJ Set Planner</div>
            <div className="text-sm text-gray-400">BPM arc, energy flow & transitions</div>
          </button>
        </div>

        {/* ── Visual Tools — full width ── */}
        <button
          onClick={() => resetMode('visuals')}
          className={`w-full p-5 rounded-xl text-left border transition-all mb-6 ${
            mode === 'visuals'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">🎨 Visual Tools & VFX</div>
              <div className="text-sm text-gray-400 mt-0.5">Live visuals, promo content & AI video tools — tailored to your genre and budget</div>
            </div>
            <div className="text-2xl opacity-30">→</div>
          </div>
        </button>

        {/* ── Release Plan — full width ── */}
        <button
          onClick={() => resetMode('release')}
          className={`w-full p-5 rounded-xl text-left border transition-all mb-3 ${
            mode === 'release'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-800 bg-gray-900 hover:border-purple-800 hover:bg-purple-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">🚀 Release Plan</div>
              <div className="text-sm text-gray-400 mt-0.5">Week-by-week rollout — playlists, content plan & Spotify pitch</div>
            </div>
            <div className="text-2xl opacity-30">→</div>
          </div>
        </button>

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

    </div>
  )
}
