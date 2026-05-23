# Producer's Toolkit — Project Progress

**Artist:** MAYVBLU (formerly Alan Aces)  
**Last updated:** May 2026  
**App:** Producer's Toolkit — AI-powered music production web app  
**Stack:** React + Vite, Tailwind CSS v4, Vercel, Anthropic SDK (`claude-haiku-4-5-20251001`)  
**Repo:** github.com/aduart03/producers-toolkit  
**Deploy:** Auto-deploys to Vercel on every `git push`

---

## How to Resume in a New Session

Paste this at the start of any new chat:

> "Read the file at /Documents/producers-toolkit/PROGRESS.md and pick up where we left off on the Producer's Toolkit app."

That's it. Read this file, get the full context, continue without re-explaining anything.

---

## Project Overview

A web app that gives MAYVBLU (and other producers) an AI assistant tuned to real production workflows — not generic advice. Built around FL Studio, UK garage/R&B production, and personal plugin chains.

**Local dev:** `npm run dev` inside `~/Documents/producers-toolkit`  
**API route:** `/api/generate.js` — Vercel serverless function, streams SSE responses  
**To deploy:** `git add src/App.jsx api/generate.js && git commit -m "message" && git push` from terminal (Claude can't push — proxy blocks git)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Entire frontend — all modes, prompts, UI, MIDI logic, stereo analysis |
| `api/generate.js` | Vercel serverless function — SSE streaming via Anthropic SDK, rate limiting |
| `public/manifest.json` | PWA manifest (installable on iOS/Android) |
| `index.html` | PWA meta tags, viewport, theme-color |
| `PROGRESS.md` | This file — session continuity |

---

## All Modes

### Grid modes (`MODES` array in App.jsx — 2-col layout)

| ID | Label | Purpose | MIDI output |
|----|-------|---------|-------------|
| `start` | 🎹 Start From Nothing | Blank canvas track brief | ✅ All 3 (via divide & conquer) |
| `stuck` | 🔁 I Have Something | Unstuck on an existing loop | Single chord |
| `lyrics` | ✍️ Lyric Concepts | Raw themes/imagery, not full lyrics | — |
| `sounds` | 🎧 Sound Discovery | Platforms, packs, flipping techniques | — |
| `mix` | 🎚️ Mix Advice | Surgical EQ & plugin tips | — |
| `design` | 🔊 Sound Design | Step-by-step patch guides (synth picker) | — |
| `generate` | 🎵 Generate Track | Suno/Udio prompt + brief | ✅ All 3 (via divide & conquer) |
| `sample` | 🎙️ Analyze Sample | Upload audio → real measurements + advice | — |
| `daw` | 🖥️ DAW & Learning | Setup guide or DAW switch guide | — |
| `vocals` | 🎤 Vocal Chain | MAYVBLU's full personal FL Studio vocal chain | — |
| `master` | 🎛️ Master Chain | MAYVBLU's full personal FL Studio master chain | — |
| `stereo` | 🌐 Stereo Analyzer | 3D stereo field map — actual vs ideal | — |

To add a new grid mode: add to `MODES` array + add case in `buildPrompt()` + add to `LOADING_MSGS` + add to `FOLLOW_UPS`.

### Standalone full-width buttons (outside MODES grid)

- `visuals` — 🎨 Visual Tools & VFX
- `release` — 🚀 Release Plan

### Side-by-side row (DJ tools)

- `dj` — 🎛️ DJ Roadmap (visual stage cards)
- `djset` — 📋 DJ Set Planner (BPM arc, energy flow)

---

## State Variables (App.jsx — complete list)

```js
// Mode & input
const [mode, setMode]                 = useState(null)
const [input, setInput]               = useState('')
const [result, setResult]             = useState('')          // displayed response (streamed)
const [loading, setLoading]           = useState(false)
const [loadingMsg, setLoadingMsg]     = useState('Thinking...')
const [copied, setCopied]             = useState(false)

// Mode-specific controls
const [chordType, setChordType]       = useState('Pad')       // chord sound type (start/stuck)
const [midiType, setMidiType]         = useState('chord')     // non-full-track modes only
const [beginnerMode, setBeginnerMode] = useState(false)       // plain English explainer
const [pedalNote, setPedalNote]       = useState(false)       // bass pedal note drone
const [selectedSynth, setSelectedSynth] = useState('')        // sound design mode
const [dawMode, setDawMode]           = useState('setup')     // 'setup' | 'transition'
const [djSetEvent, setDjSetEvent]     = useState('Club Night')
const [djSetDuration, setDjSetDuration] = useState('2 hours')
const [djSetEnergy, setDjSetEnergy]   = useState('Slow build to peak')

// MIDI
const [midiData, setMidiData]         = useState(null)        // single MIDI or full-track object
const [generatingMidi, setGeneratingMidi] = useState(false)   // second API call in progress

// Sample analysis (sample mode)
const [sampleFile, setSampleFile]         = useState(null)
const [sampleAnalysis, setSampleAnalysis] = useState(null)
const [analysingAudio, setAnalysingAudio] = useState(false)
const [audioError, setAudioError]         = useState('')
const [sampleInstrument, setSampleInstrument] = useState('Kick')
const [sampleDesc, setSampleDesc]         = useState('')

// Stereo field analyzer (stereo mode)
const [stereoFile, setStereoFile]           = useState(null)
const [stereoAnalysis, setStereoAnalysis]   = useState(null)
const [analysingStereo, setAnalysingStereo] = useState(false)
const [stereoError, setStereoError]         = useState('')
const [stereoGenre, setStereoGenre]         = useState('')
const [stereoFieldData, setStereoFieldData] = useState(null)

// Conversation / follow-up
const [conversationHistory, setConversationHistory] = useState([])
const [followUpInput, setFollowUpInput]     = useState('')

// UI / history
const [showHistory, setShowHistory]         = useState(false)
const [showGuide, setShowGuide]             = useState(false)
const [chordHistory, setChordHistory]       = useState([...])  // localStorage
const [djRoadmapData, setDjRoadmapData]     = useState(null)

// Completion Engine
const [completionStage, setCompletionStage]               = useState(0)          // 0=entry 1-5=stages 6=done
const [completionTrack, setCompletionTrack]               = useState(null)       // { name, commitment, bpm, key, vibe, direction, structure, structureTips, feedback }
const [completionInput, setCompletionInput]               = useState('')
const [completionResult, setCompletionResult]             = useState('')
const [completionLoading, setCompletionLoading]           = useState(false)
const [completionDecisions, setCompletionDecisions]       = useState([])         // confirmed decisions log
const [completionCurrentDecision, setCompletionCurrentDecision] = useState(0)   // 0,1,2
const [completionDecisionOptions, setCompletionDecisionOptions] = useState([])   // [{question,optionA,optionB}]
const [completionFile, setCompletionFile]                 = useState(null)
const [completionAnalysis, setCompletionAnalysis]         = useState(null)
const [completionChecklist, setCompletionChecklist]       = useState([false,false,false,false,false])
const [completionShowCelebration, setCompletionShowCelebration] = useState(false)
const [completionTrackName, setCompletionTrackName]       = useState('')
const [completionHistory, setCompletionHistory]           = useState([...])      // localStorage

// Refs
const fileInputRef      = useRef(null)   // sample upload
const stereoFileRef     = useRef(null)   // stereo upload
const completionFileRef = useRef(null)   // completion engine upload
const loadingTimerRef   = useRef(null)
const resultRef         = useRef(null)   // auto-scroll target
```

---

## MIDI Generation System

### Overview — Divide & Conquer (current approach)

`start` and `generate` modes use **two separate API calls**:

1. **Call 1** — `handleGenerate()` → `runGeneration()` — streams the full text response (track brief, Suno/Udio prompts, advice, etc.)
2. **Call 2** — `generateMidiForTrack(userInput, trackBrief)` — a laser-focused second call that outputs ONLY the 5 MIDI data lines

This ensures MIDI is never cut off by the main text response consuming all tokens.

```js
// Top-level function — builds the focused MIDI-only prompt
const buildMidiOnlyPrompt = (input, trackBrief) => { ... }

// Inside App component — runs the second call, sets midiData
const generateMidiForTrack = async (userInput, trackBrief) => {
  setGeneratingMidi(true)
  // calls callAI with midiOnlyPrompt
  // parses result with parseAllMidi()
  // sets midiData if valid
}
```

### MIDI-only prompt output format (5 lines)
```
MIDI: Am-F-C-G BPM: 130
MELODY: A4-C5-E5-D5-C5-A4-G4-A4 BPM: 130
BASS: A2-A2-F2-C3-A2-G2-F2-E2 BPM: 130
INSTRUMENTS: Chords:Serum wavetable pad|Melody:Vital lead|Bass:Flex 808|Drums:Kick 2
MIXER: Ch1:Kick & Drums|Ch2:Sub Bass|Ch3:Chords|Ch4:Melody|Ch5:FX
```

### Parsed into `midiData` object
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

The UI shows 3 colour-coded download cards (purple/chords, blue/melody, green/bass), an FL Studio instrument guide, and a mixer layout card.

### Single-MIDI modes (stuck, mix, etc.)
Still appends a single `MIDI: X-Y-Z BPM: 130` line to the text response. Parsed by `parseMidiLine()`, shows a single download button.

### Key MIDI functions
| Function | Purpose |
|----------|---------|
| `buildMidiOnlyPrompt(input, trackBrief)` | Builds the focused second-call prompt |
| `generateMidiForTrack(userInput, trackBrief)` | Runs the second API call, sets midiData |
| `generateChordMidi(chords, bpm)` | Converts chord names to MIDI (whole notes) |
| `generateNoteMidi(notes, bpm)` | Converts note names to MIDI (quarter notes) |
| `parseMidiLine(text)` | Parses single MIDI/MELODY/BASS line |
| `parseAllMidi(text)` | Parses all 5 lines (no `^` anchor — AI may indent) |
| `cleanResult(text)` | Strips all MIDI/INSTRUMENTS/MIXER lines from display |

### Critical: valid durations for midi-writer-js
```
'1' = whole  |  '2' = half  |  '4' = quarter  |  '8' = eighth
DO NOT use 'q' — throws "q is not a valid duration" error
```

### Chord voicings (CHORD_VOICINGS object)
```js
'C':['C4','E4','G4'],  'Cm':['C4','Eb4','G4'],  'D':['D4','F#4','A4'],
'Dm':['D4','F4','A4'], 'E':['E3','G#3','B3'],   'Em':['E3','G3','B3'],
'F':['F3','A3','C4'],  'Fm':['F3','Ab3','C4'],  'G':['G3','B3','D4'],
'Gm':['G3','Bb3','D4'],'A':['A3','C#4','E4'],   'Am':['A3','C4','E4'],
'Bb':['Bb3','D4','F4'],'Bbm':['Bb3','Db4','F4'],'B':['B3','D#4','F#4'],
'Bm':['B3','D4','F#4'],'F#m':['F#3','A3','C#4'],'C#m':['C#4','E4','G#4'],
'Ab':['Ab3','C4','Eb4'],'Eb':['Eb3','G3','Bb3']
```

### Pedal Note toggle (start mode)
When ON, tells AI to repeat one root note in the bass as a drone while harmony moves above it (UK garage / deep house technique).

---

## Stereo Field Analyzer (stereo mode)

### Flow
1. User uploads an audio file + optionally enters genre
2. `analyzeStereoField(file)` runs Web Audio API Goertzel analysis on 7 frequency bands — measures L/R energy split per band, derives pan position (-100 to +100) and overall stereo width
3. User hits Generate → `handleGenerate()` takes the stereo path (skips `buildPrompt` / `runGeneration` entirely)
4. `buildStereoPrompt(analysis, genre)` sends measured data to AI
5. AI returns 7 ACTUAL lines + 7 IDEAL lines + 1 FEEDBACK line
6. `parseStereoField(text)` parses into `{ actual, ideal, feedback }`
7. `stereoFieldData` state is set → `StereoFieldPanel` SVG components render

### Frequency bands analysed
| Band | Freq | Maps to instrument |
|------|------|--------------------|
| Sub Bass | 50 Hz | 808 / Sub |
| Kick/Bass | 120 Hz | Kick or Bass |
| Low Mids | 350 Hz | Pads / Body |
| Mids | 1 kHz | Synth Lead / Vocals |
| Upper Mids | 3.5 kHz | Hi-Hats / Snare |
| Presence | 9 kHz | Cymbals / Tops |
| Air | 16 kHz | Room / Air |

### AI output format
```
ACTUAL: 808/Sub|0|90|M
ACTUAL: Kick|0|80|S
...
IDEAL: 808/Sub|0|90|M
IDEAL: Kick|0|80|S
...
FEEDBACK: Your sub bass is slightly left — center it for better club translation.
```
`pan` = -100 (hard left) to +100 (hard right). `depth` = 0 (front/dry) to 100 (back/wet). `size` = S/M/L.

### `StereoFieldPanel` SVG component
Bird's-eye view with oval stage grid, crosshairs, L/C/R and FRONT/BACK labels. Instrument dots = glowing circles sized by S/M/L. Blue accent = ideal, purple = actual.

### UI output
- Side-by-side panels (Ideal vs Your Mix)
- Comparison table with color-coded deviation: green = on target, yellow = minor offset, red = needs attention
- Yellow "Key Fix" callout box

---

## API — `api/generate.js`

- Rate limit: 30 requests per IP per hour
- `max_tokens: 2500` (bumped from 1500 — needed for full text + MIDI footer room)
- Accepts `{ prompt }` or `{ messages }` in body
- Streams SSE: `data: {"text":"..."}` per token, `data: [DONE]` at end
- Model: `claude-haiku-4-5-20251001`

---

## Vocal Chain (FL Studio — Encoded in buildPrompt)

MAYVBLU's personal vocal chain across multiple mixer channels:

**Ch1 — Recording/Clean:** Scheps 73 / SSL G-Channel / Waves channel strip  
**Ch2 — Autotune + Preamp:** Auto-Tune Pro X (Retune 3, Flex 19, Vibrato 1.5, Humanize 51) → Clarity Vx → RDeEsser (Split, 9.5kHz) → Vocal Rider → Valhalla Delay (16%, 1/16, Ducking 18%) → Seventh Heaven (Studio B Far, low mix)  
**Ch3 — Compression:** Gate (R-Channel, -32.6dB) → VMR: VCC + FG-116 4:1 → CLA-76 (BLUEY) → Fresh Air (Mid 5, High 25) → Spiff (Cut) → Maag EQ4 Air +5  
**Ch4 — EQ:** API-560 → Ozone 8 (Vintage Comp + Exciter Triode/Tape + Dyn EQ + Vintage Limiter + Imager) → **Ozone 6 Spectral Shaper (2.38–14.8kHz, -8.4dB — secret broadband de-esser)** → Soft Clipper → Ozone 8 Maximizer → Pro-Q 3 (surgical) → CLA-2A → RDeEsser Stereo (final)  
**Ch5 — Final In Chain:** Kickstart 2 sidechain to kick #1 → VintageVerb → Seventh Heaven → EQ 2 → Fresh Air (Mid 10, High 14) → Ozone 8 Dyn EQ → CLA-76 Mono → Distructor → Peak Controller  
**Main Output:** VMR ×4 (VCC + FG-116 Modern + FG-73 Brit N cranked + FG-116 Vintage) → CLA-2A (Start Me Up) → ValhallaDElay (PingPong 50%, asymmetric L/R) → Seventh Heaven (Vocal Chamber) → VintageVerb (Chorus Space, 18.7%) → Ozone 8 Dynamics (10:1 multiband) → EQ 2 → Kickstart 2 #2 → EQ 2 → Fruity Delay 2  
**Parallel Comp Send:** VMR (VCC + FG-116 ×2 + Revival) → CLA-76 BLUEY → Distructor → Pro-Q 3 (big 500Hz boost) — blend at -18 to -20dB  
**Stereo Width L+R:** Love Philter → ValhallaDElay (PingPong 21.9%) → VintageVerb (Concert Hall, 500ms pre-delay) — faders at -14dB  
**Delay Send:** Abbey Road TG → BBDuck-Wide (1/2 note, BBD) → Seventh Heaven (Rich Plate)  

**Gain staging:** vocal peaks -6dBFS per stage; final in mix -11 to -14dBFS  
**Key insights:** Kickstart 2 sidechain to kick happens TWICE (intentional groove lock); two 1176-style compressors back to back in main VMR; VintageVerb Chorus Space mode = reverb tail that moves/modulates; Ozone Spectral Shaper catches more than a standard de-esser; Fresh Air used twice (build air gradually).

---

## Master Chain (FL Studio — Encoded in buildPrompt)

10 stages on the master channel:

1. **VMR #1** — VCC + FG-73 Brit N Pre (drive cranked) + FG-S Brit 4K EQ + FG-116 Modern (Ratio 4)
2. **Pro-Q 3 M/S** — surgical notch 300–400Hz mid, gentle side boosts for width
3. **VMR #2** — FG-S Brit 4K EQ + FG-116 Modern + Revival + Trimmer
4. **Ozone 8 "Ozone 2"** — Vintage Comp (1.9:1) + Exciter (ALL FOUR BANDS Tape, Amount 3/3/3/2) + Dyn EQ M/S + Vintage Limiter (Tube, -3dB) + **Imager (Band 1 narrows to -25 for mono bass)** + Maximizer (-14 LUFS target)
5. **Scheps 73 M/S** — Neve character, HP 50Hz
6. **TransX Multi** — 83Hz/450Hz/6809Hz crossovers, transient punch per band
7. **Abbey Road TG Mastering Chain** — EMI analogue character
8. **VMR #3** — FG-S + FG-116 + Revival + Trimmer (third console pass)
9. **SSL G-Channel** — full strip, Analog ON, final glue
10. **Ozone 8 "Ozone 3"** — ALL 4 BANDS parallel compression at Parallel 100 (final loudness/density)

**Target LUFS:** -7 to -9 for club/dance; -10 to -14 for streaming unclipped  
**Key insight:** Ozone Imager narrows Band 1 sub to mono (-25) — if sub is wide it disappears on club speakers.

---

## Release Strategy (MAYVBLU)

- Prior identity: Alan Aces — "Nubes" (28K YouTube views, 50K+ Spotify streams)
- Target: summer 2026 release as MAYVBLU
- First single: "So High" (vocals recorded, chains above applied)
- Distribution: DistroKid (add MAYVBLU as second artist profile — no new account needed)
- Format: Singles first, every 4–6 weeks for algorithmic momentum
- Content: studio process clips, FL Studio screen records, setup shots
- Home studio setup, DIY but decent

---

## 🚧 NEXT BIG FEATURE — Completion Engine

### Vision
**"Finish songs faster and more consistently."**

The core problem: producers don't finish songs. Loop hell, perfectionism, decision fatigue, endless tweaking, no visible progress, no clear definition of "done." The Completion Engine turns a loop into a finished export through guided stages, forced decisions, and a visible progress bar — completion over perfection, structure over freedom, momentum over endless tweaking.

### Core Problems Being Solved
- Stuck in loop hell — can't move past the 8-bar loop
- Perfectionism — keeps restarting instead of finishing
- Decision fatigue — too many plugin/sound choices
- Burnout — no visible progress, low dopamine reward loop
- No workflow structure — no clear "next step"
- No definition of done — doesn't know when to stop

### Product Flow

User starts by uploading:
- An audio loop (`.wav` / `.mp3`) — the seed idea
- Optional: a MIDI file

The app then guides them through **5 locked stages** in order. You can't skip ahead. Each stage has a specific job, a concrete AI-assisted task, and a "Mark Done → Next Stage" button that advances the progress bar.

---

#### Stage 1 — Idea Lock-In
**Goal:** Commit to one idea. Stop restarting.

- User describes or uploads their loop
- AI analyses the loop (BPM, key, energy, vibe)
- AI writes a one-paragraph "This is your track" commitment statement
- User hits **"Lock This In"** — can't go back and change the idea after this
- Progress bar: 20%

#### Stage 2 — Structure Builder
**Goal:** Turn a loop into an arrangement skeleton.

- AI generates a full song structure based on the loop's energy:
  - Intro → Build → Drop → Breakdown → Drop 2 → Outro
  - With bar counts (e.g. "8 bars intro, 16 bars build, 32 bars drop")
- Outputs a MIDI arrangement guide (which sections to copy, mute, filter)
- User confirms the structure
- Progress bar: 40%

#### Stage 3 — Forced Decisions
**Goal:** Eliminate decision fatigue. Make one decision at a time and move on.

- AI presents exactly 3 decisions the user must make — no more, no less. Examples:
  - "Pick ONE kick drum and delete the other two. Don't audition more."
  - "Remove 2 elements from the drop. Which 2 go?"
  - "Add ONE transition between the build and drop. FX riser or silence?"
- Each decision is presented one at a time (not all at once)
- User answers in plain text — AI confirms and logs the decision
- No going back once confirmed
- Progress bar: 60%

#### Stage 4 — Feedback Pass
**Goal:** Identify the 3 most important structural problems.

- User uploads the current bounced draft (or describes what they have)
- AI gives ONLY 3 pieces of feedback — ranked by importance:
  1. Most critical fix
  2. Second most critical fix
  3. Nice-to-have
- Deliberately limited — prevents spiral of "just one more thing"
- User addresses them (or consciously skips), marks done
- Progress bar: 80%

#### Stage 5 — Export Mode
**Goal:** Stop tweaking. Finish. Export.

- App enters a locked "Export Mode" — no new elements allowed
- AI gives a 5-point final checklist:
  - [ ] Master bus limiter on?
  - [ ] Exported at correct sample rate (44.1kHz / 48kHz)?
  - [ ] File named correctly?
  - [ ] Checked on phone speakers / AirPods?
  - [ ] Sent to one person for quick feedback?
- User ticks each box
- **"Mark as FINISHED"** button → confetti, completion message, track added to "Finished Songs" list
- Progress bar: 100% ✅

---

### UI Components Needed

**Progress Bar / Dashboard**
- Horizontal progress bar at the top of the Completion Engine mode
- 5 segments: Idea Lock-In → Structure → Decisions → Feedback → Export
- Current stage highlighted, completed stages filled in green
- Shows: track name, current stage, time spent (started X days ago)

**Stage Cards**
- Each stage = a card with: stage number, title, description, AI output area, action button
- Only the current stage is interactive — past stages shown as read-only, future stages are greyed out

**Finished Songs List**
- Simple list of completed tracks with: name, date finished, BPM, key
- Stored in localStorage
- Dopamine hit — seeing the list grow is the reward

**Decision Logger**
- Stage 3 logs each forced decision as a short entry
- Visible as a read-only "decisions made" list in the sidebar
- Reinforces commitment — you decided this, it's done

---

### AI Prompts Needed (new functions)

```js
buildIdeaLockPrompt(loopDescription, audioAnalysis)
// → returns commitment statement + BPM/key/vibe summary

buildStructurePrompt(commitmentStatement, loopBpm, loopEnergy)
// → returns bar-by-bar arrangement with section names

buildForcedDecisionsPrompt(trackState, stage)
// → returns exactly 3 decisions as JSON: [{question, options: [a, b], type: 'pick-one'|'remove'}]

buildFeedbackPrompt(draftDescription, audioAnalysis)
// → returns exactly 3 feedback items, ranked 1-2-3, no more

buildExportChecklistPrompt(trackState)
// → confirms readiness, returns the 5-item checklist
```

---

### State Needed (new)

```js
const [completionStage, setCompletionStage]   = useState(0)    // 0-5
const [completionTrack, setCompletionTrack]   = useState(null) // { name, bpm, key, vibe }
const [completionHistory, setCompletionHistory] = useState([]) // localStorage — finished songs
const [currentDecision, setCurrentDecision]   = useState(null) // one decision at a time
const [decisionLog, setDecisionLog]           = useState([])   // confirmed decisions
const [completionFile, setCompletionFile]     = useState(null) // uploaded loop
const [completionAnalysis, setCompletionAnalysis] = useState(null)
```

---

### Mode Entry Point

Add `completion` to the mode grid as a **full-width featured card** (like Release Plan), not a small 2-col tile — it's the most important new feature.

```jsx
{ id: 'completion', label: '✅ Completion Engine', desc: 'Turn your loop into a finished track — step by step' }
```

This mode has its own entirely separate UI flow inside the input panel — it doesn't use the standard `buildPrompt` / `runGeneration` path. Each stage advances state and renders a different UI.

---

### Design Principles for Build
- **One thing at a time.** Never show the next stage until the current one is done.
- **No escape hatches.** Once a stage is locked, it's locked. The back button goes to "All Tools" not to stage 1.
- **Decisions are permanent.** Stage 3 decisions are logged and visible but can't be undone.
- **Progress is visible.** The bar must always be on screen when in Completion Engine mode.
- **Celebration matters.** Stage 5 completion should feel like a win — animation, message, list entry.

---

## Pending / Next Features

### High Priority
- [x] **Completion Engine** — BUILT. Full 5-stage guided workflow live. See spec above + changelog.
- [ ] **Verify divide-and-conquer MIDI** — user said "let me test it out" — confirm MIDI files actually download and import into FL Studio correctly
- [ ] **"My Setup" profile** — user saves DAW, plugins, genres, BPM range once → injected into all prompts automatically. Store in localStorage, add to `buildPrompt()`.

### Medium Priority
- [ ] **Stereo: multi-segment analysis** — currently analyses one mid-segment. Averaging across multiple windows would give more reliable results for dynamic mixes.
- [ ] **Submission agent / CRM** — per-user feature. Requires auth. Hold until after "So High" drops.
- [ ] **AI agents post-release** — stats monitor, playlist submission tracker. Build after release.

### Ideas / Backlog
- [ ] Chord progression visualiser
- [ ] BPM/key detector input field
- [ ] Saved sessions / history export
- [ ] Export full session as PDF brief

---

## Known Bugs & Edge Cases

Status options: `[FIXED]` `[OPEN]` `[WONTFIX]`

- `[FIXED]` **No MIDI files generated** — Two causes: (1) `parseAllMidi()` used `^` anchor — leading whitespace from AI broke match. Fixed: removed `^`. (2) `max_tokens: 1500` — response hit limit before MIDI footer. Fixed: bumped to `2500` in both `App.jsx` and `api/generate.js`.
- `[FIXED]` **"q is not a valid duration"** — `midi-writer-js` uses numeric strings. Was passing `'q'`. Fixed: changed to `'4'`.
- `[FIXED]` **Same chords every time** — MIDI prompt had hardcoded example notes that AI copied literally. Fixed: removed examples, told AI to derive from key/BPM/genre.
- `[FIXED]` **Duplicate Release Plan buttons** — `release` was in MODES grid AND standalone. Fixed: removed from MODES array.
- `[FIXED]` **Git index.lock / HEAD.lock errors** — Claude's sandbox creates git lock files it can't clean. Fix: user runs `rm ~/Documents/producers-toolkit/.git/*.lock` from their own terminal then retries git commands.

To add a new entry:
```
- [OPEN] Short description — cause — how to reproduce
```

---

## Common Commands

```bash
# Local dev
cd ~/Documents/producers-toolkit && npm run dev

# Deploy
git add src/App.jsx api/generate.js PROGRESS.md
git commit -m "your message"
git push

# Fix git lock files (run from your terminal, not Claude)
rm ~/Documents/producers-toolkit/.git/*.lock

# Install a new package
npm install package-name
```

---

## Changelog (most recent first)

### May 2026 — Completion Engine
- New `completion` mode — full-width featured card in the mode grid (green, stands out)
- **Stage 0** — Entry: track name + loop description textarea + optional audio upload (real frequency analysis via `analyzeAudioFile`)
- **Stage 1 — Idea Lock-In**: `buildIdeaLockPrompt` → AI writes commitment statement + BPM/key/vibe/direction → user hits "Lock This In" (no going back)
- **Stage 2 — Structure Builder**: `buildStructurePrompt` → full bar-by-bar arrangement (Intro/Build/Drop/Breakdown/Drop 2/Outro with bar counts) + FL Studio arrangement tips
- **Stage 3 — Forced Decisions**: `buildForcedDecisionsPrompt` → exactly 3 decisions from AI, shown one at a time with Option A / Option B buttons. Each confirmed decision logged permanently. After all 3, auto-advances to stage 4.
- **Stage 4 — Feedback Pass**: `buildFeedbackPrompt` → exactly 3 feedback items (🔴 Critical / 🟡 Important / ⚪ Nice-to-have). Optional draft notes input. No more than 3 fixes.
- **Stage 5 — Export Mode**: 5-point checklist (`EXPORT_CHECKLIST`). Locked — no new elements. "Mark as FINISHED" only unlocks when all 5 checked.
- **Stage 6 — Celebration**: 🎉, track name, key/BPM/vibe, full finished songs list. "Start Another Track" resets the session.
- `completionHistory` — localStorage-persisted list of finished tracks (name, BPM, key, vibe, date). Shown in stage 0 entry screen and stage 6 celebration.
- Progress bar — 5-segment, green for completed stages, purple pulse for current stage, always visible in stages 1-5
- Decision log — permanently visible in stages 3 and 4 (can't undo, reinforces commitment)
- Parse functions: `parseIdeaLock`, `parseStructure`, `parseForcedDecisions`, `parseFeedback`
- All completion state is separate from main app state — no interference with other modes
- Back button returns to "All Tools" (completion session preserved, can re-enter)
- `resetCompletionSession()` — resets session without clearing history

### May 2026 — 3D Stereo Field Visualizer
- New `stereo` mode added to MODES grid — 🌐 Stereo Analyzer
- `analyzeStereoField(file)` — Goertzel analysis across 7 frequency bands; per-band pan position + overall stereo width
- `buildStereoPrompt(analysis, genre)` — sends measured data to AI, requests 7 ACTUAL + 7 IDEAL + FEEDBACK lines
- `parseStereoField(text)` — parses into `{ actual, ideal, feedback }`
- `StereoFieldPanel` SVG component — bird's-eye stereo field; blue = ideal, purple = actual
- Side-by-side panels + comparison table (green/yellow/red deviation) + "Key Fix" callout
- Per-band pan meter in input panel (live before hitting Generate)
- Stereo mode bypasses `buildPrompt` / `runGeneration` — has its own path in `handleGenerate`
- PROGRESS.md updated

### May 2026 — Divide & Conquer MIDI + Layout Overhaul
- MIDI generation split into two API calls: text response first, then a focused MIDI-only call (`buildMidiOnlyPrompt`, `generateMidiForTrack`)
- MIDI lines never compete with main text for tokens — fully reliable
- `FULL_MIDI_SUFFIX` removed from start/generate prompts (no longer needed)
- `generatingMidi` state + "🎹 Generating MIDI files…" spinner added between result and MIDI cards
- `max_tokens` bumped to `2500` in both `App.jsx` (dev) and `api/generate.js` (prod)
- Mode grid hides when active — replaced with `← All tools` back button + mode chip
- Result renders below Generate button (above MIDI cards), auto-scrolls into view

### May 2026 — Full-Track MIDI Composer
- `generate` and `start` modes output all 3 MIDI files at once (chords + melody + bass)
- `parseAllMidi()` — parses all 3 + instrument guide + mixer layout (no `^` anchor)
- 3 colour-coded download cards, FL Studio instrument guide card, mixer layout card
- `PROGRESS.md` created

### May 2026 — Pedal Note + MIDI Bug Fixes
- Fixed MIDI duration bug: `'q'` → `'4'`
- Fixed hardcoded MIDI output (baked-in example notes AI copied every time)
- Added Pedal Note toggle for start mode
- Release Plan moved to standalone full-width button

### May 2026 — Master Chain + Release Plan
- Master Chain mode with full 10-stage chain encoded in prompt
- Release Plan mode with week-by-week rollout, playlist targets, editorial pitch template

### Earlier — Core App
- All modes built and tuned (start, stuck, lyrics, sounds, mix, design, generate, sample, daw, vocals, master)
- Vocal Chain mode with full multi-channel FL Studio chain
- Real audio analysis (Web Audio API) for sample mode
- SSE streaming from Anthropic SDK
- PWA manifest (installable iOS/Android)
- Chord history (localStorage)
- Beginner Mode toggle
- DJ Roadmap + DJ Set Planner with visual card layout
- Visual Tools mode
