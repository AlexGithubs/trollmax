import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { BANANA_CREDIT_COSTS, STARTING_BANANA_CREDITS } from "@/lib/billing/banana-credits"
import {
  VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK,
  VIDEO_GENERATE_BASE_BANANA_CREDITS,
} from "@/lib/billing/video-generation-cost"
import { CURRENCY_MODE } from "@/lib/billing/currency-display"

export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const e = await getUserEntitlements(user.id)

  return NextResponse.json({
    currencyMode: CURRENCY_MODE,
    maxSoundboards: e.maxSoundboards,
    soundboardCount: e.soundboardCount,
    maxPhrases: e.maxPhrases,
    maxPhraseChars: e.maxPhraseChars,
    baseMaxPhrases: e.baseMaxPhrases,
    baseMaxPhraseChars: e.baseMaxPhraseChars,
    bananaCreditsBalance: e.bananaCreditsBalance,
    startingBananaCredits: STARTING_BANANA_CREDITS,
    costs: {
      soundboardGenerate: BANANA_CREDIT_COSTS.soundboardGenerate,
      soundboardExpansion: BANANA_CREDIT_COSTS.soundboardExpansion,
      videoGenerate: BANANA_CREDIT_COSTS.videoGenerate,
      videoScriptCharsPerCreditBlock: VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK,
      videoGenerateBaseBananaCredits: VIDEO_GENERATE_BASE_BANANA_CREDITS,
    },
    atSoundboardLimit: e.soundboardCount >= e.maxSoundboards,
  })
}
