# TROLLMAX — Claude Code Guide

## Working Style
- Keep code concise and functional. Eliminate redundancy.
- After implementing changes, use Playwright to verify the UI looks correct.
- Report any required env vars or external services when adding integrations.
- Don't run `npm run dev` — tell the user when ready to test.

---

## Project Overview
Next.js 15 (App Router, Turbopack) voice cloning soundboard + brainrot video generator.

- **Auth:** Clerk (`@clerk/nextjs`) — all `/app/*` routes are protected via middleware
- **KV store:** Vercel KV in prod, in-memory `MockManifestStore` in dev
- **File storage:** Vercel Blob in prod, `MockFileStore` in dev
- **TTS:** Replicate F5-TTS (`x-lance/f5-tts:87faf6dd...`) — current active provider
- **Payments:** Stripe (stub — not fully wired)

Mock mode (no real APIs): `NEXT_PUBLIC_MOCK_MODE=true`

---

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts          # Audio upload — validates, trims, stores to Blob
│   │   ├── soundboard/
│   │   │   ├── route.ts             # POST — create soundboard manifest
│   │   │   └── [id]/generate/route.ts  # POST — F5-TTS clip generation (one per phrase)
│   │   ├── health/route.ts          # GET — service health check
│   │   └── test/route.ts            # Seed/test endpoint (dev only)
│   ├── app/                         # Authenticated app shell
│   │   ├── layout.tsx               # Sidebar nav
│   │   ├── page.tsx                 # Dashboard
│   │   └── soundboard/
│   │       ├── page.tsx             # List user's soundboards
│   │       ├── new/page.tsx         # Create soundboard (upload → phrases → generate)
│   │       └── [id]/page.tsx        # View/manage single soundboard
│   ├── s/[id]/page.tsx              # Public shareable soundboard — /s/{id}
│   ├── v/[id]/page.tsx              # Public video viewer — /v/{id}
│   ├── pricing / privacy / terms / takedown/  # Static + legal pages
│   └── page.tsx                     # Landing page
├── components/
│   ├── ui/                          # shadcn/ui primitives (button, card, badge, separator)
│   ├── soundboard/
│   │   ├── SoundboardPlayer.tsx     # Audio playback UI for clips
│   │   ├── GeneratingCard.tsx       # Animated waveform waiting screen
│   │   ├── ShareLinkCopy.tsx        # Copy share link to clipboard
│   │   └── DeleteBoardButton.tsx    # Delete with confirmation
│   ├── landing/
│   │   ├── HeroSection.tsx          # Landing hero + product cards
│   │   ├── ProductCard.tsx          # Feature card component
│   │   └── ConsentBanner.tsx        # Consent/legal banner
│   └── layout/
│       ├── SiteHeader.tsx           # Public nav header
│       └── SiteFooter.tsx           # Footer links
└── lib/
    ├── providers/
    │   ├── index.ts                 # Factory: getTTSProvider / getCaptionsProvider / getVideoComposer
    │   ├── types.ts                 # TTSProvider, CaptionsProvider, VideoComposer interfaces
    │   └── tts/
    │       ├── replicate-f5tts.ts   # ACTIVE — F5-TTS zero-shot via Replicate
    │       ├── modal-xtts.ts        # Fallback — XTTS v2 via Modal (requires MODAL_XTTS_URL)
    │       └── mock.ts              # Dev mock
    ├── audio/
    │   └── trim-and-encode.ts       # Browser: silence trim + 22050Hz mono WAV encode
    ├── manifests/
    │   └── types.ts                 # SoundboardManifest, VideoManifest, SoundClip, Caption, KV key schema
    ├── storage/
    │   ├── index.ts                 # getManifestStore() / getFileStore() factories
    │   ├── types.ts                 # ManifestStore, FileStore interfaces
    │   ├── kv.ts                    # Vercel KV implementation
    │   ├── blob.ts                  # Vercel Blob implementation
    │   └── mock-store.ts            # In-memory dev store (globalThis singleton)
    ├── rate-limit.ts                # 10 uploads/hr, 5 generates/hr per user (KV or in-memory)
    ├── stripe.ts                    # Stripe client stub
    └── utils.ts                     # cn() and shared helpers
```

---

## Soundboard Generation Flow

```
Browser: user uploads audio
  → trimAndEncodeAudio()          # silence trim, 22050Hz mono 16-bit WAV
  → POST /api/upload              # validate duration (6–30s), store to Blob
  → POST /api/soundboard          # create manifest with phrases
  → POST /api/soundboard/:id/generate
      → for each phrase:
          F5-TTS synthesize()     # Replicate x-lance/f5-tts, upload to Blob
      → save updated manifest to KV
  → redirect to /app/soundboard/:id
```

---

## Provider Selection (env-driven)

| Env var | Provider activated |
|---|---|
| `NEXT_PUBLIC_MOCK_MODE=true` | All providers use mocks |
| `REPLICATE_API_TOKEN` | F5-TTS via `x-lance/f5-tts` |
| `MODAL_XTTS_URL` | Modal XTTS v2 (TTS fallback) |
| `MODAL_WHISPER_URL` | Modal Whisper (captions — not used in soundboard flow) |
| `MODAL_FFMPEG_URL` | Modal FFmpeg (video — not yet implemented) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (file storage) |
| `KV_REST_API_URL` | Vercel KV (manifest storage) |

---

## KV Key Schema

```
soundboard:{id}             → SoundboardManifest JSON
video:{id}                  → VideoManifest JSON
user:{clerkId}:soundboards  → set of soundboard IDs
user:{clerkId}:videos       → set of video IDs
user:{clerkId}:subscription → SubscriptionRecord JSON
takedown:{id}               → TakedownRequest JSON
```

---

## Key Types (`src/lib/manifests/types.ts`)

- `SoundClip` — `{ id, label, text, audioUrl, durationSeconds, createdAt }`
- `SoundboardManifest` — extends `BaseManifest` with `voiceId`, `voiceSampleUrl`, `phrases[]`, `clips[]`
- `VideoManifest` — extends `BaseManifest` with `script`, `backgroundVideoId`, `captions[]`, `status`, `videoUrl?`

---

## Audio Pipeline Notes

- `trimAndEncodeAudio` (browser, Web Audio API): outputs 22050 Hz mono 16-bit PCM WAV — must be public URL (Vercel Blob) so Replicate can fetch it as `ref_audio`
- F5-TTS outputs 24000 Hz mono 16-bit WAV (~48000 bytes/s for duration estimate)
- Duration estimate formula: `Math.max(1, Math.round(bytes / 48000))`
- File storage: Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, `LocalFileStore` (`/api/dev-assets`) otherwise
