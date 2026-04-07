import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import ReactMarkdown from 'react-markdown'
import MidiWriter from 'midi-writer-js'
import './App.css'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
})

// ─── Chord voicings (for chord MIDI) ─────────────────────────────────────────
const CHORD_VOICINGS = {
  'C': ['C4','E4','G4'],   'Cm': ['C4','Eb4','G4'],
  'D': ['D4','F#4','A4'],  'Dm': ['D4','F4','A4'],
  'E': ['E3','G#3','B3'],  'Em': ['E3','G3','B3'],
  'F': ['F3','A3','C4'],   'Fm': ['F3','Ab3','C4'],
  'G': ['G3','B3','D4'],   'Gm': ['G3','Bb3','D4'],
  'A': ['A3','C#4','E4'],  'Am': ['A3','C4','E4'],
  'Bb': ['Bb3','D4','F4'], 'Bbm': ['Bb3','Db4','F4'],
  'B': ['B3','D#4','F#4'], 'Bm': ['B3','D4','F#4'],
  'F#m': ['F#3','A3','C#4'], 'C#m': ['C#4','E4','G#4'],
  'Ab': ['Ab3','C4','Eb4'],  'Eb': ['Eb3','G3','Bb3'],
}

const CHORD_TYPES = ['Pad', 'Pluck', 'Lead Synth', 'Stab', 'Arp', 'Piano', 'Rhodes', 'Bass']

const SYNTHS = ['Serum 2', 'Serum', 'Vital (free)', 'Sylenth1', 'Massive X', 'Phase Plant', 'Pigments', 'Diva', 'Surge XT (free)']

const MIDI_TYPES = [
  { id: 'chord',   label: '🎹 Chords',   desc: 'Chord progression' },
  { id: 'melody',  label: '🎵 Melody',   desc: 'Lead melody line' },
  { id: 'bass',    label: '🔉 Bassline', desc: 'Bass pattern' },
]

const MODES = [
  { id: 'start',  label: '🎹 Start From Nothing', desc: 'Blank canvas direction' },
  { id: 'stuck',  label: '🔁 I Have Something',   desc: 'Get unstuck on your loop' },
  { id: 'lyrics', label: '✍️ Lyric Concepts',      desc: 'Raw themes, not cheesy AI' },
  { id: 'sounds', label: '🎧 Sound Discovery',     desc: 'Beyond Splice' },
  { id: 'mix',    label: '🎚️ Mix Advice',           desc: 'Surgical EQ & plugin tips' },
  { id: 'design', label: '🔊 Sound Design',         desc: 'Recreate any sound' },
  { id: 'sample', label: '🎙️ Analyse Sample',       desc: 'Fix your sample in the mix' },
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

// ─── Parsing ──────────────────────────────────────────────────────────────────
const parseMidiLine = (text) => {
  const chordMatch = text.match(/MIDI:\s*([\w#b]+(?:-[\w#b]+)*)\s+BPM:\s*(\d+)/i)
  if (chordMatch) return { type: 'chord', notes: chordMatch[1].split('-'), bpm: parseInt(chordMatch[2]) }

  const melodyMatch = text.match(/MELODY:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (melodyMatch) return { type: 'melody', notes: melodyMatch[1].split('-'), bpm: parseInt(melodyMatch[2]) }

  const bassMatch = text.match(/BASS:\s*([\w#b\d]+(?:-[\w#b\d]+)*)\s+BPM:\s*(\d+)/i)
  if (bassMatch) return { type: 'bass', notes: bassMatch[1].split('-'), bpm: parseInt(bassMatch[2]) }

  return null
}

const cleanResult = (text) =>
  text
    .replace(/MIDI:.*BPM:\s*\d+/gi, '')
    .replace(/MELODY:.*BPM:\s*\d+/gi, '')
    .replace(/BASS:.*BPM:\s*\d+/gi, '')
    .trim()

// ─── Prompts ──────────────────────────────────────────────────────────────────
const buildPrompt = ({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc }) => {
  const beginnerBlock = beginnerMode ? `

---
**BEGINNER EXPLAINER** (add this section at the very end):
In plain, simple English:
- What this chord progression means — e.g. "Em means E minor, which sounds dark and moody"
- How to physically find these notes on a keyboard (count up from C)
- What a "${chordType}" sounds like in real terms (e.g. "a Pad is a slow, airy sustained sound like a choir in the background")
- What the BPM means in real life (e.g. "130 BPM — tap your finger to it, it feels like a brisk walk")
- One practical tip for a complete beginner on how to place these chords in FL Studio` : ''

  // Melody mode (overrides chord/start)
  if (mode === 'start' && midiType === 'melody') {
    return `You are a music production assistant. Generate a melodic idea for a ${input} track.

Give: key/scale recommendation, mood description, BPM range, what the melody should feel like, and a step-by-step guide for a beginner on how to use it.

At the very end on its own line output EXACTLY (8-12 notes, note+octave format):
MELODY: E4-G4-A4-G4-E4-D4-C4-D4 BPM: 130

Use note names like C4 D4 E4 F4 G4 A4 B4 and sharps/flats like F#4 Bb3${beginnerBlock}`
  }

  // Bass mode
  if (mode === 'start' && midiType === 'bass') {
    return `You are a music production assistant. Generate a bassline idea for a ${input} track.

Give: key/scale, BPM, describe the bassline character (e.g. rolling sub, punchy stabs), and how to use it.

At the very end on its own line output EXACTLY (8 notes in bass register):
BASS: E2-E2-G2-A2-E2-G2-A2-C3 BPM: 130

Use bass-register notes: C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 with sharps/flats${beginnerBlock}`
  }

  if (mode === 'start') return `You are a music producer assistant with deep knowledge of electronic music.
A producer is starting from scratch and needs a creative direction.

Give them:
- Suggested BPM range
- Key/scale recommendation
- A chord progression suited for a **${chordType}** sound
- Song structure breakdown
- 2-3 reference tracks
- One unique production element to make it stand out

Format with clear headers and **bold** key info.

Their vibe: ${input}

At the very end on its own line output EXACTLY:
MIDI: Em-G-D-A BPM: 140
Only use: C Cm D Dm E Em F Fm G Gm A Am Bb Bbm B Bm F#m C#m Ab Eb${beginnerBlock}`

  if (mode === 'stuck') return `You are a music producer assistant. A producer is stuck on something they've started.
Give 3 specific directions they could take it, each with: what to add next, energy arc, production technique.
Format with headers. Be direct.

What they have: ${input}

At the very end on its own line output EXACTLY:
MIDI: Em-G-D-A BPM: 140
Only use: C Cm D Dm E Em F Fm G Gm A Am Bb Bbm B Bm F#m C#m Ab Eb`

  if (mode === 'lyrics') return `You are helping a music producer find their lyrical voice for UK electronic music.
DO NOT write full lyrics — generate raw material to SPARK their own writing:
- 3-4 raw themes or angles to explore
- Vivid imagery and metaphors that fit the mood
- Emotional tensions to write from
- 5-8 title/hook fragment seeds (single lines/phrases, not full hooks)
- 1-2 artists' lyrical approaches to reference
Keep it raw, not cheesy. Their concept: ${input}`

  if (mode === 'sounds') return `You are a music producer assistant helping find new sounds.
Suggest: 5 specific platforms beyond Splice with search terms, 3 free sample packs or artists to look up, 2 creative techniques to flip samples in a fresh way.
Be specific — name actual platforms, packs, artists. Their situation: ${input}`

  if (mode === 'mix') return `You are a professional mixing engineer specialising in electronic music (UK garage, house, techno, speed garage).
Give extremely specific mixing advice:
- Exact EQ moves: frequency, dB, Q values
- Compression settings: attack / release / ratio / threshold
- Sidechain suggestions if relevant
- Specific plugins (free first, then paid)
- What to listen for after each change
Be surgical. Their problem: ${input}`

  if (mode === 'design') {
    const synthNote = selectedSynth
      ? `The producer is using **${selectedSynth}**. Give the patch guide using that synth's exact parameter names and interface.`
      : `Give the patch guide for Serum/Vital (most common).`
    return `You are a sound design expert for electronic music production.
${synthNote}

Give:
- Synthesis approach (wavetable / subtractive / FM / etc.)
- Step-by-step patch guide with exact parameter values (filter cutoff Hz, resonance %, envelope times in ms, LFO rate, etc.)
- FX chain with specific settings (reverb room size, delay time in ms, distortion type and drive %)
- 2 tips to make it uniquely theirs

Note: if they reference a track timestamp (e.g. "0:56"), I can't access audio directly — but I'll recreate the artist's known sound design signature.

Their request: ${input}`
  }

  if (mode === 'sample') return `You are a professional mixing engineer. Give specific processing advice for this sample.

- EQ: exact frequencies, dB cuts/boosts, Q values
- Compression: threshold, ratio, attack, release, makeup gain
- Transient shaping if relevant
- FX (reverb, delay, saturation) with specific settings
- Gain staging advice
- Plugins to use (free first, paid options after)

Instrument: ${sampleInstrument}
Description: ${sampleDesc}`

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
  const [midiData, setMidiData] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sampleInstrument, setSampleInstrument] = useState('Kick')
  const [sampleDesc, setSampleDesc] = useState('')

  const [chordHistory, setChordHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chordHistory') || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('chordHistory', JSON.stringify(chordHistory))
  }, [chordHistory])

  const currentMode = MODES.find(m => m.id === mode)

  const handleGenerate = async () => {
    if (!mode) return
    setLoading(true)
    setResult('')
    setMidiData(null)

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: buildPrompt({ mode, input, chordType, midiType, beginnerMode, selectedSynth, sampleInstrument, sampleDesc })
        }]
      })

      const text = message.content[0].text
      const parsed = parseMidiLine(text)
      const cleaned = cleanResult(text)

      if (parsed) {
        const uri = parsed.type === 'chord'
          ? generateChordMidi(parsed.notes, parsed.bpm)
          : generateNoteMidi(parsed.notes, parsed.bpm)

        setMidiData({ ...parsed, uri })

        // Save to history including the full response text
        const entry = {
          id: Date.now(),
          type: parsed.type,
          progression: parsed.notes.join(' → '),
          bpm: parsed.bpm,
          chordType: parsed.type === 'chord' ? chordType : parsed.type,
          label: input.substring(0, 45) + (input.length > 45 ? '…' : ''),
          timestamp: new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }),
          response: cleaned,
        }
        setChordHistory(prev => [entry, ...prev].slice(0, 100))
      }

      setResult(cleaned)
    } catch (err) {
      setResult('Error: ' + err.message)
      console.error(err)
    }

    setLoading(false)
  }

  const canGenerate = mode === 'sample'
    ? sampleDesc.trim().length > 0
    : (input.trim().length > 0 || mode === 'sample')

  const midiTypeIcon = { chord: '🎹', melody: '🎵', bass: '🔉' }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Producer's Toolkit</h1>
            <p className="text-gray-400 mt-1">UK Garage · House · Techno · Speed Garage</p>
          </div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              showHistory
                ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                : 'border-gray-700 bg-gray-900 hover:border-gray-500 text-gray-300'
            }`}
          >
            📋 History
            {chordHistory.length > 0 && (
              <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {chordHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-200">Generation History</h2>
              {chordHistory.length > 0 && (
                <button onClick={() => setChordHistory([])} className="text-xs text-red-400 hover:text-red-300">
                  Clear all
                </button>
              )}
            </div>
            {chordHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No history yet — generate something first.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {chordHistory.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => { setResult(entry.response); setShowHistory(false) }}
                    className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-purple-300 font-mono font-semibold text-sm">
                        {midiTypeIcon[entry.type] || '🎹'} {entry.progression}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{entry.bpm} BPM</span>
                        <span className="bg-purple-900/60 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-700">
                          {entry.chordType}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{entry.label} · {entry.timestamp}</div>
                    <div className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to restore full response →
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setInput(''); setResult(''); setMidiData(null) }}
              className={`p-4 rounded-xl text-left border transition-all ${
                mode === m.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="font-semibold mb-0.5">{m.label}</div>
              <div className="text-sm text-gray-400">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Input Area */}
        {mode && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">

            {/* Start From Nothing: MIDI type + chord type + beginner toggle */}
            {mode === 'start' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">What to generate</label>
                  <div className="flex gap-2">
                    {MIDI_TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setMidiType(t.id)}
                        className={`flex-1 p-2.5 rounded-lg text-sm border transition-all ${
                          midiType === t.id
                            ? 'border-purple-500 bg-purple-500/20 text-purple-200'
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
                        <button
                          key={t}
                          onClick={() => setChordType(t)}
                          className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                            chordType === t
                              ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                              : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Beginner mode toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBeginnerMode(b => !b)}
                    className={`relative w-10 h-5 rounded-full border transition-colors shrink-0 ${
                      beginnerMode ? 'bg-purple-600 border-purple-500' : 'bg-gray-700 border-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        beginnerMode ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-300">
                    🔰 Beginner Mode
                    <span className="text-gray-500 text-xs ml-1.5">
                      explains chords, sounds & BPM in plain English
                    </span>
                  </span>
                </div>
              </>
            )}

            {/* I Have Something: chord type */}
            {mode === 'stuck' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Chord Sound Type (for MIDI)</label>
                <div className="flex flex-wrap gap-2">
                  {CHORD_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setChordType(t)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                        chordType === t
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sound Design: synth selector */}
            {mode === 'design' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Your Synth</label>
                <div className="flex flex-wrap gap-2">
                  {SYNTHS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedSynth(selectedSynth === s ? '' : s)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                        selectedSynth === s
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sample analysis inputs */}
            {mode === 'sample' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Instrument / Sound Type</label>
                  <div className="flex flex-wrap gap-2">
                    {['Kick', 'Snare/Clap', 'Hi-hat', 'Bass', 'Synth/Lead', 'Pad', 'Vocal Chop', 'Full Loop', 'FX/Riser'].map(t => (
                      <button
                        key={t}
                        onClick={() => setSampleInstrument(t)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          sampleInstrument === t
                            ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={sampleDesc}
                  onChange={e => setSampleDesc(e.target.value)}
                  placeholder="Describe what you hear and the problem — e.g. vocal chop sounds muddy, low-mid buildup around 300Hz, gets buried in the mix..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none text-sm"
                />
              </div>
            ) : (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  mode === 'start'  ? 'e.g. Dark UK garage, late night feel, 130 BPM range...' :
                  mode === 'stuck'  ? 'e.g. I have a 4-bar loop with an Em pad and rolling bassline, don\'t know what to add...' :
                  mode === 'lyrics' ? 'e.g. Driving through London at 3am, paranoid energy...' :
                  mode === 'sounds' ? 'e.g. I mainly use Splice but keep using the same sounds. I make speed garage...' :
                  mode === 'mix'    ? 'e.g. Kick gets lost under the bassline in a speed garage track. FL Studio, Kick2, Serum...' :
                  mode === 'design' ? 'e.g. I want a synth like John Summit - Where You Are. Warm, slightly distorted house lead.' :
                  'Tell me more...'
                }
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all"
            >
              {loading ? 'Thinking...' : 'Generate'}
            </button>
          </div>
        )}

        {/* MIDI Download */}
        {midiData && (
          <div className="mb-4 p-4 bg-purple-900/30 border border-purple-500/30 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-purple-300">
                {midiTypeIcon[midiData.type]} MIDI Ready
              </div>
              <div className="text-sm text-gray-400 mt-0.5">
                {midiData.notes.join(' → ')} · {midiData.bpm} BPM
                {midiData.type === 'chord' && ` · ${chordType}`}
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

        {/* Result */}
        {result && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 prose prose-invert max-w-none">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        )}

      </div>
    </div>
  )
}
