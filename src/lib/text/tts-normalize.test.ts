import assert from "node:assert/strict"
import test from "node:test"
import { normalizeTextForTTS } from "./tts-normalize"

test("expands common abbreviations", () => {
  assert.equal(normalizeTextForTTS("that is fr wild rn"), "that is for real wild right now")
})

test("preserves selected meme abbreviations", () => {
  assert.equal(normalizeTextForTTS("lol this is crazy lmao"), "lol this is crazy lmao")
})

test("keeps punctuation and word boundaries", () => {
  assert.equal(
    normalizeTextForTTS("idk... wdym? frankly it's fine."),
    "I don't know... what do you mean? frankly it's fine."
  )
})

test("expands uppercase abbreviations with uppercase output", () => {
  assert.equal(normalizeTextForTTS("IDK FR"), "I DON'T KNOW FOR REAL")
})
