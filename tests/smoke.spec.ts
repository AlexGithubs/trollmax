import { test, expect } from "@playwright/test"

const BASE = "http://localhost:3000"

// ── Landing page ────────────────────────────────────────────────────────────
test("landing page — renders hero + two product sections", async ({ page }) => {
  await page.goto(BASE)
  await expect(page).toHaveTitle(/TROLLMAX/)
  await expect(page.getByText("Clone anyone.")).toBeVisible()
  await expect(page.getByText("Troll everyone.")).toBeVisible()
  await expect(page.getByText("Voice Cloning Soundboard")).toBeVisible()
  await expect(page.getByText("Brainrot Video Generator")).toBeVisible()
  await expect(page.getByRole("link", { name: /soundboard/i }).first()).toBeVisible()
  await expect(page.getByText(/Consent-first/)).toBeVisible()
  await expect(page.getByRole("banner").getByRole("link", { name: "Pricing" })).toBeVisible()
  await expect(page.getByRole("banner").getByRole("link", { name: "TROLLMAX" })).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/landing.png", fullPage: true })
})

// ── Pricing page ────────────────────────────────────────────────────────────
test("pricing page — Free + Pro tiers visible", async ({ page }) => {
  await page.goto(`${BASE}/pricing`)
  await expect(page).toHaveTitle(/Pricing/)
  await expect(page.getByText("Simple pricing")).toBeVisible()
  await expect(page.getByText("$0")).toBeVisible()
  await expect(page.getByText("$12")).toBeVisible()
  await expect(page.getByText(/soundboard/i).first()).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/pricing.png", fullPage: true })
})

// ── Legal pages ─────────────────────────────────────────────────────────────
test("/terms renders", async ({ page }) => {
  await page.goto(`${BASE}/terms`)
  await expect(page).toHaveTitle(/Terms/)
  await expect(page.getByRole("heading", { name: /Terms of Service/i })).toBeVisible()
  await expect(page.getByText(/Consent requirement/)).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/terms.png", fullPage: true })
})

test("/privacy renders", async ({ page }) => {
  await page.goto(`${BASE}/privacy`)
  await expect(page).toHaveTitle(/Privacy/)
  await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/privacy.png", fullPage: true })
})

test("/takedown renders DMCA form", async ({ page }) => {
  await page.goto(`${BASE}/takedown`)
  await expect(page).toHaveTitle(/Takedown/)
  await expect(page.getByRole("heading", { name: /Takedown/i })).toBeVisible()
  await expect(page.locator("#name")).toBeVisible()
  await expect(page.locator("#email")).toBeVisible()
  await expect(page.locator("#url")).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/takedown.png", fullPage: true })
})

// ── Auth redirects ───────────────────────────────────────────────────────────
test("/app redirects to Clerk sign-in when logged out", async ({ page }) => {
  await page.goto(`${BASE}/app`)
  await expect(page).not.toHaveURL(`${BASE}/app`)
  const url = page.url()
  expect(url.includes("clerk") || url.includes("sign-in") || url.includes("accounts.")).toBe(true)
  await page.screenshot({ path: "tests/screenshots/app-redirect.png" })
})

test("/app/soundboard redirects to Clerk sign-in when logged out", async ({ page }) => {
  await page.goto(`${BASE}/app/soundboard`)
  await expect(page).not.toHaveURL(`${BASE}/app/soundboard`)
  const url = page.url()
  expect(url.includes("clerk") || url.includes("sign-in") || url.includes("accounts.")).toBe(true)
})

test("/app/soundboard/new redirects to Clerk sign-in when logged out", async ({ page }) => {
  await page.goto(`${BASE}/app/soundboard/new`)
  await expect(page).not.toHaveURL(`${BASE}/app/soundboard/new`)
  const url = page.url()
  expect(url.includes("clerk") || url.includes("sign-in") || url.includes("accounts.")).toBe(true)
})

// ── Share routes ─────────────────────────────────────────────────────────────
test("/s/[id] — missing board shows 404 card, no server error", async ({ page }) => {
  await page.goto(`${BASE}/s/test123`)
  await expect(page.getByRole("heading", { name: /Soundboard not found/i })).toBeVisible()
  await expect(page.getByText(/Create your own/i)).toBeVisible()
  await expect(page.getByRole("banner")).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/share-soundboard.png" })
})

test("/v/[id] — video stub renders", async ({ page }) => {
  await page.goto(`${BASE}/v/test456`)
  await expect(page.getByText(/Video not found/i)).toBeVisible()
  await expect(page.getByText(/test456/)).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/share-video.png" })
})

// ── Health API ───────────────────────────────────────────────────────────────
test("/api/health returns ok + ts (mockMode in non-production)", async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`)
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.ts).toBeTruthy()
  if ("mockMode" in json) {
    expect(json.mockMode).toBe(true)
  }
})

// ── API — 401 when unauthenticated ───────────────────────────────────────────
test("POST /api/upload — 401 when unauthenticated", async ({ request }) => {
  const res = await request.post(`${BASE}/api/upload`, {
    multipart: { file: { name: "t.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(100) } },
  })
  expect(res.status()).toBe(401)
})

test("DELETE /api/upload — 401 when unauthenticated", async ({ request }) => {
  const res = await request.fetch(`${BASE}/api/upload`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ url: "https://example.com/samples/u/x.mp3" }),
  })
  expect(res.status()).toBe(401)
})

test("POST /api/soundboard — 401 when unauthenticated", async ({ request }) => {
  const res = await request.post(`${BASE}/api/soundboard`, {
    data: { title: "t", speakerLabel: "t", voiceSampleUrl: "http://x.com/a.mp3", phrases: ["hi"], consentAcknowledged: true },
  })
  expect(res.status()).toBe(401)
})

test("GET /api/voice-presets returns public preset metadata", async ({ request }) => {
  const res = await request.get(`${BASE}/api/voice-presets`)
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(Array.isArray(json.categories)).toBe(true)
  expect(json.categories.length).toBeGreaterThan(0)
  expect(json.categories[0]).toHaveProperty("id")
  expect(json.categories[0]).toHaveProperty("label")
  expect(Array.isArray(json.presets)).toBe(true)
  expect(json.presets.length).toBeGreaterThan(0)
  const activeCount = json.presets.filter((p: { status?: string }) => p.status === "active").length
  const comingSoonCount = json.presets.filter(
    (p: { status?: string }) => p.status === "coming_soon"
  ).length
  expect(activeCount).toBe(json.presets.length)
  expect(comingSoonCount).toBe(0)
  const first = json.presets[0]
  expect(first).toHaveProperty("id")
  expect(first).toHaveProperty("label")
  expect(first).toHaveProperty("defaultSpeakerLabel")
  expect(first).toHaveProperty("categoryId")
  expect(first).toHaveProperty("status")
  expect(first).not.toHaveProperty("refAudioUrl")
  expect(first).not.toHaveProperty("refText")
})

test("GET /api/voice-presets/:id/preview — 401 when unauthenticated", async ({ request }) => {
  const res = await request.get(`${BASE}/api/voice-presets/rw-chris/preview`)
  expect(res.status()).toBe(401)
})

test("GET /api/voice-presets/:id/preview-audio — 401 when unauthenticated", async ({ request }) => {
  const res = await request.get(`${BASE}/api/voice-presets/rw-chris/preview-audio`)
  expect(res.status()).toBe(401)
})

test("POST /api/soundboard with voicePresetId — 401 when unauthenticated", async ({ request }) => {
  const res = await request.post(`${BASE}/api/soundboard`, {
    data: {
      title: "t",
      voicePresetId: "tone-sarcastic",
      phrases: ["hi"],
      consentAcknowledged: true,
    },
  })
  expect(res.status()).toBe(401)
})

test("POST /api/soundboard/x/generate — 401 when unauthenticated", async ({ request }) => {
  const res = await request.post(`${BASE}/api/soundboard/fakeid/generate`)
  expect(res.status()).toBe(401)
})

test("DELETE /api/soundboard/x — 401 when unauthenticated", async ({ request }) => {
  const res = await request.delete(`${BASE}/api/soundboard/fakeid`)
  expect(res.status()).toBe(401)
})

// ── Mock soundboard end-to-end via test seed helper ──────────────────────────
test("/s/[id] — seeded board renders title + clip buttons", async ({ request, page }) => {
  const seedRes = await request.post(`${BASE}/api/test/seed-soundboard`)
  expect(seedRes.status()).toBe(200)
  const { id, title } = await seedRes.json()

  await page.goto(`${BASE}/s/${id}`)
  await expect(page.getByRole("heading", { name: title })).toBeVisible()
  const clipBtns = page.locator("button").filter({ hasText: /./i })
  await expect(clipBtns.first()).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/share-soundboard-live.png", fullPage: true })
})

test("/s/[id] — share link anchor is shown on board page", async ({ request, page }) => {
  const seedRes = await request.post(`${BASE}/api/test/seed-soundboard`)
  expect(seedRes.status()).toBe(200)
  const { id } = await seedRes.json()

  await page.goto(`${BASE}/s/${id}`)
  await expect(page.locator(`a[href*="/s/${id}"]`)).toBeVisible()
  await page.screenshot({ path: "tests/screenshots/share-copy-link.png" })
})

test("/s/[id] — clicking play button stays on page", async ({ request, page }) => {
  const seedRes = await request.post(`${BASE}/api/test/seed-soundboard`)
  expect(seedRes.status()).toBe(200)
  const { id } = await seedRes.json()

  await page.goto(`${BASE}/s/${id}`)
  const firstClip = page.locator("button").filter({ hasText: /./i }).first()
  await firstClip.click()
  await expect(page).toHaveURL(`${BASE}/s/${id}`)
  await page.screenshot({ path: "tests/screenshots/share-clip-playing.png" })
})
