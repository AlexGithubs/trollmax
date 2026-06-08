import { BANANA_CREDIT_COSTS } from "./credit-costs"

export function soundboardRequiresExpansion(
  phrases: string[],
  baseMaxPhrases: number,
  baseMaxPhraseChars: number
): boolean {
  return (
    phrases.length > baseMaxPhrases ||
    phrases.some((phrase) => phrase.length > baseMaxPhraseChars)
  )
}

export function soundboardGenerationCostBananaCredits(
  phrases: string[],
  baseMaxPhrases: number,
  baseMaxPhraseChars: number
): number {
  const requiresExpansion = soundboardRequiresExpansion(
    phrases,
    baseMaxPhrases,
    baseMaxPhraseChars
  )
  return (
    BANANA_CREDIT_COSTS.soundboardGenerate +
    (requiresExpansion ? BANANA_CREDIT_COSTS.soundboardExpansion : 0)
  )
}
