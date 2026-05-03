# Producer's Toolkit — Project Progress

**Artist:** MAYVBLU (formerly Alan Aces)  
**Last updated:** May 2026  
**App:** Producer's Toolkit — AI-powered music production assistant  
**Stack:** React + Vite, Tailwind CSS v4, Vercel, Anthropic SDK (claude-haiku-4-5-20251001)  
**Repo:** github.com/aduart03/producers-toolkit  
**Deploy:** Auto-deploys to Vercel on every `git push`

---

## How to Resume in a New Session

Paste this at the start of any new chat:

> "Read the file at /Documents/producers-toolkit/PROGRESS.md and pick up where we left off on the Producer's Toolkit app."

That's it. I'll read the file, get the full context, and we can continue without re-explaining anything.

---

## Project Overview

A web app that gives MAYVBLU (and other producers) an AI assistant tuned to real production workflows — not generic advice. Built around FL Studio, UK garage/R&B production, and personal plugin chains.

**Local dev:** `npm run dev` inside `~/Documents/producers-toolkit`  
**API route:** `/api/generate.js` — Vercel serverless function, streams SSE responses via Anthropic SDK  
**To deploy:** `git add . && git commit -m "message" && git push` from terminal

---

## App Architecture

### Key Files
- `src/App.jsx` — entire frontend: modes, prompts, UI, MIDI generation logic
- `api/generate.js` — Vercel serverless function, handles streaming to client
- `public/manifest.json` — PWA manifest (installable on iOS/Android)
- `index.html` — PWA meta tags, viewport, theme-color

### State Variables (App.jsx)
```js
const [mode, setMode] = useState(null)
const [input, setInput] = useState('')
const [output, setOutput] = useState('')
const [loading, setLoading] = useState(false)
const [chordType, setChordType] = useState('Pad')    // chord sound type
const [midiType, setMidiType] = useState('chord')    // used only by non-full-track modes now
const [beginnerMode, setBeginnerMode] = useState(false)
const [pedalNote, setPedalNote] = useState(false)    // bass pedal note drone
const [selectedSynth, setSelectedSynth] = useState('')
const [sampleInstrument, setSampleInstrument] = useState('')
const [sampleDesc, setSampleDesc] = useState('')
const [sampleAnalysis, setSampleAnalysis] = useState(null)
const [dawMode, setDawMode] = useState('setup')       // 'setup' | 'transition'
const [midiData, setMidiData] = useState(null)        // single MIDI or full-track object
const [djSetEvent, setDjSetEvent] = useState('Club Night')
const [djSetDuration, setDjSetDuration] = useState('2 hours')
const [djSetEnergy, setDjSetEnergy] = useState('Slow build to peak')
```

---

## All Modes

### Grid modes (2-col layout via `MODES` array)
| ID | Label | Purpose |
|----|-------|---------|
| `start` | 🎹 Start From Nothing | Blank canvas — outputs full track brief + all 3 MIDI files |
| `stuck` | 🔁 I Have Something | Get unstuck on an existing loop |
| `lyrics` | ✍️ Lyric Concepts | Raw themes/imagery, not cheesy full lyrics |
| `sounds` | 🎧 Sound Discovery | Platforms, packs, flipping techniques |
| `mix` | 🎚️ Mix Advice | Surgical EQ & plugin tips |
| `design` | 🔊 Sound Design | Step-by-step patch guides |
| `generate` | 🎵 Generate Track | Suno/Udio prompt + all 3 MIDI files + instrument guide |
| `sample` | 🎙️ Analyze Sample | Upload audio for real measurements + mixing advice |
| `daw` | 🖥️ DAW & Learning | Setup guide or DAW switch guide |
| `vocals` | 🎤 Vocal Chain | MAYVBLU's full personal FL Studio vocal chain |
| `master` | 🎛️ Master Chain | MAYVBLU's full personal FL Studio master chain |

To reorder: just change the order of objects in the `MODES` array.  
To add a new grid mode: add to MODES + add case in `buildPrompt` + add to `LOADING_MSGS` + add to `FOLLOW_UPS`.

### Standalone full-width buttons (outside MODES grid)
- `visuals` — 🎨 Visual Tools & VFX
- `release` — 🚀 Release Plan

To add more: copy the release button JSX pattern — a `<button>` with `w-full`, placed after the `MODES.map()` grid.

### Side-by-side buttons (DJ tools row)
- `dj` — 🎛️ DJ Roadmap
- `djset` — 📋 DJ Set Planner

---

## MIDI Generation System

### Overview
`generate` and `start` modes now output **all 3 MIDI files in one response** + an FL Studio instrument guide + mixer layout. Other modes (stuck, mix, etc.) still output a single chord MIDI at the end.

### Full-Track MIDI (generate + start modes)
The AI response ends with this block which gets parsed out:
```
MIDI: Am-F-C-G BPM: 130
MELODY: A4-C5-E5-D5-C5-A4-G4-A4 BPM: 130
BASS: A2-A2-F2-C3-A2-G2-F2-E2 BPM: 130
INSTRUMENTS: Chords:Serum wavetable pad|Melody:Vital lead|Bass:Flex 808|Drums:Kick 2
MIXER: Ch1:Kick & Drums|Ch2:Sub Bass|Ch3:Chords|Ch4:Melody|Ch5:FX
```

`parseAllMidi(text)` extracts all of the above into:
```js
{
  isFullTrack: true,
  chord:  { notes: ['Am','F','C','G'], bpm: 130, uri: '...data:...' },
  melody: { notes: ['A4','C5','E5',...], bpm: 130, uri: '...' },
  bass:   { notes: ['A2','A2','F2',...], bpm: 130, uri: '...' },
  instruments: { chords: 'Serum wavetable pad', melody: '...', bass: '...', drums: '...' },
  mixer: [{ ch: 1, label: 'Kick & Drums', detail: '' }, ...]
}
```

The UI shows 3 colour-coded download cards (purple/chords, blue/melody, green/bass), an instrument guide, and a mixer layout card.

### Single-MIDI (other modes)
```js
{ isFullTrack: false, type: 'chord'|'melody'|'bass', notes: [...], bpm: 130, uri: '...' }
```
Single download button, same as before.

### Key functions
- `generateChordMidi(chords, bpm)` — full chord voicings, whole notes
- `generateNoteMidi(notes, bpm)` — single pitch per note, quarter notes (`'4'` — NOT `'q'`)
- `parseMidiLine(text)` — parses single MIDI/MELODY/BASS line (used by non-full-track modes)
- `parseAllMidi(text)` — parses all 3 + instruments + mixer (used by generate/start)
- `cleanResult(text)` — strips all MIDI/MELODY/BASS/INSTRUMENTS/MIXER lines from the displayed response

### Valid durations for midi-writer-js
```
'1' = whole note  |  '2' = half  |  '4' = quarter  |  '8' = eighth
DO NOT use 'q' — causes "q is not a valid duration" error
```

### Chord voicings
```js
const CHORD_VOICINGS = {
  'C':['C4','E4','G4'],  'Cm':['C4','Eb4','G4'],  'D':['D4','F#4','A4'],
  'Dm':['D4','F4','A4'], 'E':['E3','G#3','B3'],   'Em':['E3','G3','B3'],
  'F':['F3','A3','C4'],  'Fm':['F3','Ab3','C4'],  'G':['G3','B3','D4'],
  'Gm':['G3','Bb3','D4'],'A':['A3','C#4','E4'],   'Am':['A3','C4','E4'],
  'Bb':['Bb3','D4','F4'],'Bbm':['Bb3','Db4','F4'],'B':['B3','D#4','F#4'],
  'Bm':['B3','D4','F#4'],'F#m':['F#3','A3','C#4'],'C#m':['C#4','E4','G#4'],
  'Ab':['Ab3','C4','Eb4'],'Eb':['Eb3','G3','Bb3'],
}
```

### Pedal Note toggle
Visible in start mode. When ON, adds to prompt:
```
Use a pedal note approach — pick one root note in the bass register and repeat it as a 
drone/anchor throughout the pattern while the harmony moves above it. Common in UK garage.
```

---

## Vocal Chain (FL Studio — Encoded in App)

MAYVBLU's personal vocal chain across multiple mixer channels:

**Channel 1 — Recording/Clean Chain**  
Scheps 73 / SSL G-Channel / Waves channel strip for warmth and vintage character.

**Channel 2 — Autotune + Preamp**  
Auto-Tune Pro X (Retune Speed 3, Flex Tune 19, Natural Vibrato 1.5, Humanize 51) → Clarity Vx → Waves RDeEsser (Split mode, ~9.5kHz, first pass) → Vocal Rider → Valhalla Delay (Mix 16%, 1/16, Ducking 18%) → Seventh Heaven (Studio B Far, low mix)

**Channel 3 — Compression**  
Gate (R-Channel, -32.6dB) → VMR: VCC + FG-116 4:1 → CLA-76 (BLUEY mode) → Fresh Air (Mid 5, High 25) → Spiff (Cut mode) → Maag EQ4 Air Band +5

**Channel 4 — EQ**  
API-560 → Ozone 8 (Vintage Comp + Exciter Triode/Tape + Dynamic EQ + Vintage Limiter + Imager) → Ozone 6 Spectral Shaper (2.38kHz-14.8kHz, THE secret de-esser) → Fruity Soft Clipper → Ozone 8 Maximizer → Pro-Q 3 (surgical cuts) → CLA-2A → RDeEsser Stereo (final pass)

**Channel 5 — Final In Chain**  
Kickstart 2 (sidechain to kick #1) → ValhallaVintageVerb → Seventh Heaven → EQ 2 → Fresh Air (Mid 10, High 14) → Ozone 8 Dynamic EQ → CLA-76 Mono → Distructor → Peak Controller

**Main Output ("Official Vocal")**  
VMR ×4 stacked (VCC + FG-116 Modern + FG-73 Brit N Pre cranked + FG-116 Vintage) → CLA-2A (Start Me Up) → ValhallaDElay (PingPong 50% mix, asymmetric L/R) → Seventh Heaven (Vocal Chamber) → ValhallaVintageVerb (Chorus Space mode, 18.7% mix) → Ozone 8 Dynamics (10:1, aggressive multiband) → EQ 2 → Kickstart 2 #2 → EQ 2 → Fruity Delay 2

**Parallel Compression Send**  
VMR (VCC + FG-116 ×2 + Revival) → CLA-76 (BLUEY, Ratio 4) → Distructor → Pro-Q 3 (big 500Hz mid boost) — blend at -18 to -20dB

**Stereo Width Channels (L+R pair)**  
Love Philter → ValhallaDElay (PingPong 21.9%) → ValhallaVintageVerb (Concert Hall, 500ms pre-delay) — faders at -14dB

**Delay Send**  
Abbey Road TG → BBDuck-Wide (1/2 note, BBD mode) → Seventh Heaven (Rich Plate)

**Gain staging targets:** vocal peaks at -6dBFS per stage; final vocal in mix -11 to -14dBFS

**Key insights:**
1. Kickstart 2 sidechain to kick happens TWICE (chain + output) — intentional groove lock
2. Two 1176-style compressors back to back in main output VMR (Modern + Vintage circuits)
3. ValhallaVintageVerb Chorus Space mode = reverb tail that modulates and moves (not static)
4. Ozone Spectral Shaper as broadband de-esser = catches more than a standard de-esser
5. Two Fresh Air hits (comp channel + final chain) — build air gradually

---

## Master Chain (FL Studio — Encoded in App)

10 stages on the master channel:

1. **VMR #1** — VCC + FG-73 Brit N Pre (drive cranked) + FG-S Brit 4K EQ + FG-116 Modern (Ratio 4)
2. **Pro-Q 3 M/S** — surgical notch 300-400Hz mid, multiple small mid cuts, gentle side boosts for width
3. **VMR #2** — FG-S Brit 4K EQ + FG-116 Modern + Revival + Trimmer
4. **Ozone 8 "Ozone 2" (6 modules)** — Vintage Comp (1.9:1, -12.3dB) + Exciter (ALL FOUR BANDS Tape mode, Amount 3/3/3/2) + Dynamic EQ M/S + Vintage Limiter (Tube, -3dB) + Imager (Band1 -25 mono bass, Bands 2-4 wide) + Maximizer (-14 LUFS target)
5. **Scheps 73 M/S** — Neve character, HP 50Hz, vintage colour
6. **TransX Multi** — 83Hz/450Hz/6809Hz crossovers, controls transient punch per band
7. **Abbey Road TG Mastering Chain** — TG12411/12412/12413/12414 (EMI analogue feel)
8. **VMR #3** — FG-S + FG-116 + Revival + Trimmer (third console pass)
9. **SSL G-Channel** — full strip, Analog ON, final glue
10. **Ozone 8 "Ozone 3"** — multiband parallel compression ALL 4 BANDS at Parallel 100

**Target LUFS:** -7 to -9 LUFS for club/dance; -10 to -14 LUFS for streaming unclipped  
**Key insight:** Ozone Imager narrows Band 1 to -25 (mono bass) — essential for club systems

---

## Loading Messages
```js
const LOADING_MSGS = {
  start:    ['Thinking...', 'Setting the vibe...', 'Building your brief...', 'Finding reference tracks...'],
  generate: ['Thinking...', 'Drafting the brief...', 'Writing prompts...', 'Composing the structure...'],
  vocals:   ['Thinking...', 'Building the chain...', 'Setting the gain staging...', 'Tuning the processing...'],
  master:   ['Thinking...', 'Checking the chain...', 'Analysing the headroom...', 'Preparing the master...'],
  release:  ['Thinking...', 'Building the timeline...', 'Finding the right playlists...', 'Mapping the rollout...'],
  // + stuck, lyrics, sounds, mix, design, sample, daw, transition, dj, djset, visuals
}
```

---

## Follow-Up Chips
Each mode has 4 curated follow-up suggestion chips that appear after a response. To add/edit: update the `FOLLOW_UPS` object in App.jsx.

---

## Release Strategy (MAYVBLU)

- Prior identity: Alan Aces — Nubes (28K YouTube views, 50K+ Spotify streams)
- Target summer 2026 release as MAYVBLU
- First single: "So High" (vocals recorded, mixed with chains above)
- Distribution: DistroKid (set up MAYVBLU as second artist profile — no new account needed)
- Format: Singles first, every 4-6 weeks for algorithmic momentum
- Content: studio process videos, FL Studio screen records, setup shots

---

## Pending / Next Features

### High Priority
- [ ] **"My Setup" profile** — user saves their DAW, plugins, genres, BPM range once → all prompts get personalised context automatically. Store in localStorage, inject into every `buildPrompt()` call.
- [ ] **Push to Vercel** — Claude can't push (proxy blocks git). Always run `git push` from your terminal after any code session.

### Medium Priority  
- [ ] **Submission agent / CRM** — per-user feature. Requires auth (login/accounts). Hold until after initial release, then consider as a proper multi-user app with a backend.
- [ ] **AI agents post-release** — stats monitor, content idea generator, playlist submission tracker. Build after So High drops.

### Ideas / Backlog
- [ ] Chord progression visualiser
- [ ] BPM/key detector input field
- [ ] Saved sessions / history export
- [ ] Export full session as PDF brief

---

## Known Bugs & Edge Cases

Track issues here as they're found. Format: `- [STATUS] Description — cause — fix`  
Status options: `[FIXED]` `[OPEN]` `[WONTFIX]`

- `[FIXED]` **No MIDI files generated after full-track update** — `parseAllMidi()` used `^` (start-of-line) anchor in regex. If the AI added a space/dash/formatting before the MIDI lines, match failed and nothing parsed. Fix: removed `^` from all 5 regexes, now matches anywhere in text. (Same approach as original `parseMidiLine`.)
- `[FIXED]` **MIDI duration error: "q is not a valid duration"** — `midi-writer-js` uses numeric strings (`'4'` = quarter note), not music letters. Was passing `'q'`. Fix: changed to `'4'`.
- `[FIXED]` **Same chords/melody/bass every time regardless of input** — MIDI prompt had hardcoded example notes (`Em-G-D-A`, `E4-G4-A4`, `E2-E2-G2`) that the AI copied literally. Fix: removed examples, told AI to derive notes from the key/BPM/genre it just described.
- `[FIXED]` **Duplicate Release Plan buttons** — `release` was in both the `MODES` grid array AND as a standalone button. Fix: removed from `MODES` array, kept standalone button only.

### How to add a new entry
Open `PROGRESS.md` in VS Code and paste a new line under this section:
```
- [OPEN] Short description of the bug — what caused it — how to reproduce it
```
Then change `[OPEN]` to `[FIXED]` once it's resolved, with a note on what fixed it.

---

## Changelog (most recent first)

### May 2026 — Full-Track MIDI Composer
- `generate` and `start` modes now output **all 3 MIDI files in one response** (chords + melody + bass)
- Added `parseAllMidi()` function to parse all 3 parts + instrument guide + mixer layout
- New `FULL_MIDI_SUFFIX` prompt anchors MIDI to the actual key/BPM/genre the AI described (fixes the "same chords every time" bug)
- UI: 3 colour-coded download cards, FL Studio instrument guide card, mixer layout card
- `start` mode: removed per-instrument type picker, always generates all 3, kept chord type + beginner mode + pedal note
- Added PROGRESS.md — update this file after every session

### May 2026 — Pedal Note + MIDI Bug Fixes
- Fixed MIDI duration bug: `'q'` → `'4'` (midi-writer-js uses numeric strings)
- Fixed hardcoded MIDI output: chord/melody/bass prompts all had baked-in example notes that AI copied every time
- Added Pedal Note toggle for bassline generation (drone root note, UK garage / deep house)
- Release Plan moved out of MODES grid to standalone full-width button

### May 2026 — Master Chain + Release Plan modes
- Added Master Chain mode with full 10-stage chain encoded in prompt
- Added Release Plan mode with week-by-week rollout, playlist targets, editorial pitch template
- Added loading messages and follow-up chips for both

### Earlier — Core App Build
- All 11 grid modes built and tuned
- Vocal Chain mode with full multi-channel FL Studio chain encoded
- Real audio analysis (Web Audio API) for Sample Analyze mode
- SSE streaming from Anthropic SDK
- PWA manifest + meta tags (installable on iOS/Android)
- Chord progression history (localStorage)
- Beginner Mode toggle
- DJ Roadmap + DJ Set Planner modes with visual card layout
- Visual Tools mode

---

## Common Commands

```bash
# Local dev
cd ~/Documents/producers-toolkit
npm run dev

# Deploy (git push triggers Vercel auto-deploy)
git add .
git commit -m "your message"
git push

# Install a new package
npm install package-name

# Install Python package (in Cowork shell)
pip install package-name --break-system-packages
```
