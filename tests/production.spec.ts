import { test, expect } from "@playwright/test"

/**
 * Live site smoke against https://trollmax.xyz
 * Run: npx playwright test tests/production.spec.ts
 * If the agent shell sets PLAYWRIGHT_BROWSERS_PATH to a bad cache, use:
 *   env -u PLAYWRIGHT_BROWSERS_PATH npx playwright test tests/production.spec.ts
 */
const PROD = "https://trollmax.xyz"

test("production — home loads with hero + products", async ({ page }) => {
  await page.goto(PROD)
  await expect(page).toHaveTitle(/TROLLMAX/)
  await expect(page.getByText("Clone anyone.")).toBeVisible()
  await expect(page.getByText("Troll everyone.")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /Voice Cloning Soundboard/i }).first()
  ).toBeVisible()
  await expect(page.getByText("Brainrot Video Generator").first()).toBeVisible()
})

test("production — /api/health returns 200 + ok", async ({ request }) => {
  const res = await request.get(`${PROD}/api/health`)
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.ts).toBeTruthy()
})
