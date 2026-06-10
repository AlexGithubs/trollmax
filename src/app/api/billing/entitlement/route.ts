import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { BANANA_CREDIT_COSTS, STARTING_BANANA_CREDITS } from "@/lib/billing/banana-credits"
import {
  MAX_VIDEO_SCRIPT_CHARS,
  VIDEO_SCRIPT_BASE_CHARS,
  VIDEO_SCRIPT_EXTRA_CHARS_PER_BLOCK,
  VIDEO_SCRIPT_EXTRA_BLOCK_BANANA_CREDITS,
  VIDEO_GENERATE_BASE_BANANA_CREDITS,
} from "@/lib/billing/video-generation-cost"
import { CURRENCY_MODE } from "@/lib/billing/currency-display"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const e = await getUserEntitlements(user.id)

  return NextResponse.json(
    {
      currencyMode: CURRENCY_MODE,
      maxSoundboards: e.maxSoundboards,
      soundboardCount: e.soundboardCount,
      maxPhrases: e.maxPhrases,
      maxPhraseChars: e.maxPhraseChars,
      baseMaxPhrases: e.baseMaxPhrases,
      baseMaxPhraseChars: e.baseMaxPhraseChars,
      bananaCreditsBalance: e.bananaCreditsBalance,
      startingBananaCredits: STARTING_BANANA_CREDITS,
      maxVideoScriptChars: MAX_VIDEO_SCRIPT_CHARS,
      costs: {
        soundboardGenerate: BANANA_CREDIT_COSTS.soundboardGenerate,
        soundboardExpansion: BANANA_CREDIT_COSTS.soundboardExpansion,
        videoGenerate: BANANA_CREDIT_COSTS.videoGenerate,
        videoScriptBaseChars: VIDEO_SCRIPT_BASE_CHARS,
        videoScriptExtraCharsPerBlock: VIDEO_SCRIPT_EXTRA_CHARS_PER_BLOCK,
        videoScriptExtraBlockBananaCredits: VIDEO_SCRIPT_EXTRA_BLOCK_BANANA_CREDITS,
        videoGenerateBaseBananaCredits: VIDEO_GENERATE_BASE_BANANA_CREDITS,
      },
      atSoundboardLimit: e.soundboardCount >= e.maxSoundboards,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
