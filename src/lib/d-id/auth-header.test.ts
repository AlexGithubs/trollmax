import assert from "node:assert/strict"
import test from "node:test"
import { buildDidAuthHeader, normalizeDidCredentials } from "./auth-header"

const envSnapshot = { ...process.env }

test.afterEach(() => {
  process.env = { ...envSnapshot }
})

test("uses DID_API_KEY when set", () => {
  process.env.DID_API_KEY = "user@example.com:secret-key"
  delete process.env.DID_API_USERNAME
  delete process.env.DID_API_PASSWORD
  assert.deepEqual(normalizeDidCredentials(), {
    username: "user@example.com",
    password: "secret-key",
  })
})

test("accepts email:password in a single username var", () => {
  process.env.DID_API_USERNAME = "user@example.com:secret-key"
  delete process.env.DID_API_PASSWORD
  delete process.env.DID_API_KEY
  assert.deepEqual(normalizeDidCredentials(), {
    username: "user@example.com",
    password: "secret-key",
  })
})

test("uses D-ID literal Basic format (not RFC base64)", () => {
  process.env.DID_API_USERNAME = "YWxleHNodmE0QGdtYWlsLmNvbQ"
  process.env.DID_API_PASSWORD = "secret-key"
  delete process.env.DID_API_KEY
  assert.equal(buildDidAuthHeader(), "Basic YWxleHNodmE0QGdtYWlsLmNvbQ:secret-key")
})
