# Producer's Toolkit

An AI-powered creative assistant built for electronic music producers — UK Garage, House, Techno, Speed Garage. Built to help with the real pain points: writer's block, getting unstuck, finding new sounds, and making mixing decisions.

Built by a CS grad and producer with 7+ years in the scene.

---

## What It Does

**8 modes, all focused on practical production help:**

| Mode | What it does |
|---|---|
| 🎹 Start From Nothing | Give it a vibe, get back BPM, key, chord progression, song structure, reference tracks, and a unique production idea |
| 🔁 I Have Something | Describe your loop or idea and get 3 specific directions to take it |
| ✍️ Lyric Concepts | Raw themes, imagery, and hook seeds — not AI lyrics, just fuel for your own writing |
| 🎧 Sound Discovery | Find samples and sounds beyond Splice — specific platforms, search terms, free packs |
| 🎚️ Mix Advice | Surgical EQ, compression, and plugin recommendations with exact values |
| 🔊 Sound Design | Recreate any sound — step-by-step patch guides with exact parameter values for your synth |
| 🎵 Generate Track | Get an optimised Suno/Udio prompt to paste into those tools for full AI audio + stem export |
| 🎙️ Analyse Sample | Upload an audio file — the app runs real frequency analysis (peak, RMS, frequency bands, clipping, stereo width) and Claude gives advice based on the actual measurements |

### MIDI Generation
Start From Nothing and I Have Something both generate downloadable MIDI files. You can choose:
- **Chords** — Full chord progression (tailored to Pad, Pluck, Stab, Arp, Rhodes, etc.)
- **Melody** — Lead melody note sequence
- **Bassline** — Bass pattern in the low register

**Beginner Mode** — Toggle it on to get plain-English explanations of what the chords mean, how to find them on a keyboard, what BPM feels like, and how to place the MIDI in FL Studio.

### Chord History
Every generation with MIDI is saved to a persistent history log (localStorage). Click any entry to restore the full response.

---

## Stack

- **React** (with Vite v8)
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin)
- **Anthropic SDK** — `claude-haiku-4-5-20251001` for all AI responses
- **midi-writer-js** — MIDI file generation in the browser
- **Web Audio API** — Real frequency analysis of uploaded audio (browser-native, no extra API needed)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/producers-toolkit.git
cd producers-toolkit
npm install
```

### 2. Add your API key

Create a `.env` file in the project root:

```
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get your API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run locally

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173).

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "ready to deploy"
git push
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** → select your repository
3. Framework preset: **Vite** (auto-detected)
4. Under **Environment Variables**, add:
   - Key: `VITE_ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
5. Click **Deploy**

That's it — you'll get a live URL in about a minute.

---

## API Cost & Public Deployment

The API key is used client-side (browser). This means:

- **You pay for all usage** — anyone using the deployed site uses your key
- The key is embedded in the JS bundle and visible to anyone who inspects the page
- **Set a monthly spend limit** in your Anthropic console to cap exposure

### Cost estimate (Haiku model)

| Usage | Estimated cost |
|---|---|
| Personal use (10–20 prompts/day) | ~$0.01–0.05/day |
| 100 users, 5 prompts each | ~$0.25–0.50 total |
| 1,000 users, 10 prompts each | ~$2.50–5.00 total |

Haiku is very cheap. For personal use or sharing with friends, the current setup is fine.

### How to protect the key for real public use

**Option A — User provides their own key** (no backend needed)
Add a settings screen where users paste their own Anthropic API key, stored in `localStorage`. They pay for their own usage.

**Option B — Vercel serverless function** (proper backend proxy)
Move the API call to a Vercel Edge Function. The key stays server-side and is never exposed in the browser. Add rate limiting per IP.

---

## Notes

- **Song generation** — The Generate Track mode creates an optimised prompt for Suno or Udio. Paste it into [suno.com](https://suno.com) (free tier available) for high-quality AI audio with stem export on their paid plan.
- **Sample analysis** — Uses the browser's built-in Web Audio API. Measures frequency content via the Goertzel algorithm, peak/RMS via time-domain analysis, stereo width via channel correlation. No audio is ever sent to a server — only the measured numbers go to the Anthropic API.

---

## Roadmap

- [ ] User-provided API key input (safer for public deploy)
- [ ] Vercel serverless function proxy (proper backend)
- [ ] HuggingFace MusicGen integration for in-app audio generation
- [ ] Stem separation via Demucs
- [ ] BPM detection from uploaded audio
- [ ] Save full sessions
