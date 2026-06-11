# TROLLMAX — Claude Code Guide

## Working style
- Keep diffs small and match existing patterns. Remove dead code instead of leaving parallel paths.
- After UI changes, run Playwright smoke tests if available (`tests/smoke.spec.ts`).
- Do **not** run `npm run dev` — tell the user when ready to test locally.
- Report new required env vars when adding integrations.

---

## What this product is

**TROLLMAX** is a Next.js 15 (App Router) app with two generators:

1. **Voice soundboard** — clone a voice (preset or upload), type phrases, get one-tap audio clips at `/s/{id}`.
2. **Brainrot video** — script + headshot + voice → 9:16 talking-head video with optional gameplay background and burned-in captions at `/v/{id}`.

Users pay with **banana credits** (one-time Stripe packs). New accounts start with 5 credits.

---

## Architecture at a glance

| Layer | Production | Dev / mock |
|--------|------------|------------|
| Auth | Clerk | Clerk (or mock mode skips real APIs) |
| Manifests | Upstash Redis (`UPSTASH_REDIS_*`) | In-memory `MockManifestStore` |
| Files | Vercel Blob | Local dev assets |
| Voice TTS + clone | **ElevenLabs only** (`ELEVENLABS_API_KEY`) | `MockTTSProvider` |
| Video captions | **Replicate Whisper** (`REPLICATE_API_TOKEN`) via `transcribe-for-captions.ts` | Skipped / script-timed fallback |
| Talking head | **HeyGen** (`TALKING_HEAD_PROVIDER=heygen`) or **D-ID** fallback | Mock composer |
| Video compositing | **Modal FFmpeg** (`MODAL_FFMPEG_URL` + token auth) | `MockVideoComposer` |
| Payments | Stripe Checkout (credit packs) | Localhost instant grant |

Set `NEXT_PUBLIC_MOCK_MODE=true` to run without external APIs.

---

## External services (env vars)

Copy from `.env.example`. **Do not add** `MODAL_XTTS_URL` or `MODAL_WHISPER_URL` — those code paths were removed.

| Env var | Required for | Notes |
|---------|----------------|-------|
| `ELEVENLABS_API_KEY` | Soundboard + video voice | Presets need `VOICE_PRESET_*_PROVIDER_ID` per preset |
| `REPLICATE_API_TOKEN` | Video captions (optional) | Only when user enables captions; not used for TTS |
| `TALKING_HEAD_PROVIDER` | Video | `heygen` (preferred) or `did` (default if unset) |
| `HEYGEN_API_KEY` | Video (HeyGen path) | Pay-as-you-go API wallet |
| `DID_API_USERNAME` + `DID_API_PASSWORD` | Video (D-ID path) | Alternative talking-head provider |
| `MODAL_FFMPEG_URL` | Video compose | From `modal deploy modal/video_composer.py` |
| `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` | Modal auth | Basic auth to compositor endpoint |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Manifests + credits | Atomic credit debit requires Redis |
| `BLOB_READ_WRITE_TOKEN` | Uploads | Audio, headshots, generated assets |
| Stripe pack price IDs | Credit purchases | See `src/lib/billing/credit-packs.ts` |

---

## Banana credits (billing)

- **Storage key:** `user:{clerkId}:doinks` (historical name; values are banana credits).
- **Debit:** `tryDebitBananaCredits` — atomic on Redis; refunds via `creditBananaCredits` on pipeline failure.
- **Costs** (`src/lib/billing/credit-costs.ts`, `video-generation-cost.ts`):

| Action | Credits |
|--------|---------|
| Soundboard (≤6 phrases, ≤70 chars each) | 1 |
| Soundboard expansion (>6 phrases or any phrase >70 chars) | +0.5 (total 1.5) |
| Video — first 250 script chars | 2 |
| Video — each additional 100 chars (ceil) | +0.5 |
| Max script length | 750 characters |

There is **no** TTS tier choice — everything uses ElevenLabs. Captions do not change credit cost.

---

## Generation pipelines

### Soundboard

```
POST /api/soundboard          → create manifest (draft)
POST /api/soundboard/:id/generate
  → resolveSoundboardVoiceForGenerate()  // ElevenLabs IVC if upload; preset uses EL voice ID
  → for each phrase (concurrency ≤3): provider.synthesize()
  → upload IVC only: releaseEphemeralSoundboardClone() — delete EL voice, reset voiceId to sample URL
  → clips uploaded to Blob; manifest status complete
```

Voice resolution: `src/lib/tts/resolve-voice-for-generate.ts`  
Provider factory: `getTtsProviderForTier()` → always ElevenLabs IVC provider.

### Video

```
POST /api/video               → create draft manifest
POST /api/video/:id/generate
  1. ElevenLabs TTS — full script → audioUrl
  2. Parallel (if not mock):
       - captions ON → transcribeForCaptions() (Replicate Whisper, 18s timeout)
       - talking head → runHeygenTalkingHead() OR runDidTalkingHead()
  3. buildCaptions() if captions enabled
  4. getVideoComposer().compose() — Modal FFmpeg (background + layout + burn-in)
  5. Delete headshot blob; manifest complete
```

Talking-head selection: `TALKING_HEAD_PROVIDER` env in `src/app/api/video/[id]/generate/route.ts`.

**Important:** Captions do **not** go through `getCaptionsProvider()` — they call Replicate directly in `src/lib/video/transcribe-for-captions.ts`.

---

## Provider factory (`src/lib/providers/index.ts`)

Only two exports matter:

- `getTtsProviderForTier()` → ElevenLabs (or mock)
- `getVideoComposer()` → Modal FFmpeg (or mock)

Do not reintroduce Replicate F5, Modal XTTS, or Modal Whisper provider files.

---

## Key directories

```
src/app/
  api/
    upload/              Audio sample upload
    headshot-upload/     Video headshot upload
    soundboard/          Create + generate + status
    video/               Create, draft autosave, generate, status
    billing/             Entitlements, Stripe checkout, webhooks
    tts-availability/    Whether ElevenLabs (+ preset IDs) configured
  app/                   Authenticated UI (Clerk; some create routes public)
  s/[id]  v/[id]         Public share pages
  pricing/               Credit packs

src/lib/
  billing/               Credits, packs, entitlements, video/soundboard cost helpers
  tts/                   resolve-voice-for-generate, tiers (always elevenlabs)
  providers/             TTS + video composer only
  d-id/  heygen/         Talking-head providers (env-selected)
  video/                 captions, backgrounds, transcribe-for-captions
  replicate/             url-for-model-input.ts (Whisper caption input only)
  manifests/types.ts     SoundboardManifest, VideoManifest, KV schema
  storage/               KV + Blob abstractions

modal/
  video_composer.py      Deploy for MODAL_FFMPEG_URL
```

---

## KV key schema

```
soundboard:{id}                  → SoundboardManifest JSON
video:{id}                       → VideoManifest JSON
user:{clerkId}:soundboards       → set of board IDs
user:{clerkId}:videos            → set of video IDs
user:{clerkId}:doinks            → banana credit balance (string number)
generate_lock:soundboard:{id}    → generation mutex
generate_lock:video:{id}         → generation mutex
```

---

## Auth & routes

- Clerk middleware protects `/app/*` except list/create surfaces: `/app/video`, `/app/soundboard`, `/app/video/new`, `/app/soundboard/new`.
- Generation requires sign-in; credits debited on generate POST.

---

## Voice presets

- Catalog: `src/lib/voice-presets/` (presets-data, categories, catalog.ts).
- Each active preset needs `VOICE_PRESET_{ID}_PROVIDER_ID` in env (ElevenLabs voice ID).
- Client checks `/api/tts-availability` for `elevenlabs` + `elevenlabsPresetVoicesReady`.

---

## Common mistakes (avoid these)

1. **Adding Replicate for TTS** — removed; ElevenLabs only.
2. **Wiring captions through a new CaptionsProvider** — use `transcribeForCaptions()` or extend that file.
3. **Assuming D-ID is the only talking-head provider** — HeyGen is primary when `TALKING_HEAD_PROVIDER=heygen`.
4. **Creating a second billing module** — use `banana-credits.ts` only (`doinks.ts` was deleted).
5. **Charging different credits for captions or TTS tier** — only script length (video) and phrase expansion (soundboard) affect cost.

---

## Tests & scripts

- `tests/smoke.spec.ts` — pricing page, basic navigation
- `src/lib/d-id/auth-header.test.ts` — D-ID auth format
- `scripts/prepare-headshot-presets.ts` — offline headshot prep for preset catalog

---

## Audio upload notes

- Browser: `trimAndEncodeAudio()` → 22050 Hz mono 16-bit WAV (`src/lib/audio/trim-and-encode.ts`).
- Upload validates duration; samples stored on Vercel Blob.
- ElevenLabs IVC clones on first generate when user uploads a custom voice (not presets).
