const EXPANSIONS: Record<string, string> = {
  fr: "for real",
  rn: "right now",
  idk: "I don't know",
  imo: "in my opinion",
  imho: "in my humble opinion",
  ngl: "not gonna lie",
  tbh: "to be honest",
  brb: "be right back",
  afk: "away from keyboard",
  wdym: "what do you mean",
  ikr: "I know right",
  smh: "shaking my head",
  stfu: "shut the fuck up",
  tf: "the fuck",
  bc: "because",
  cuz: "because",
  tho: "though",
}

const PRESERVE_AS_IS = new Set([
  "lol",
  "lmao",
  "rofl",
  "omg",
  "wtf",
])

const TOKEN_PATTERN = /\b[a-zA-Z]{2,10}\b/g

export function normalizeTextForTTS(input: string): string {
  return input.replace(TOKEN_PATTERN, (rawToken) => {
    const token = rawToken.toLowerCase()

    if (PRESERVE_AS_IS.has(token)) {
      return token
    }

    const expansion = EXPANSIONS[token]
    if (!expansion) {
      return rawToken
    }

    // Keep sentence casing when user types uppercase abbreviation.
    if (rawToken === rawToken.toUpperCase()) {
      return expansion.toUpperCase()
    }

    return expansion
  })
}
