import {
  CREDIT_PACK_IDS,
  FEATURED_CREDIT_PACK_ID,
  type CreditPackId,
  getCreditPacksForPublic,
} from "@/lib/billing/credit-packs"
import { CreditCheckoutClient } from "./CreditCheckoutClient"

export const metadata = {
  title: "Top up credits — TROLLMAX",
  description: "Buy banana credit packs.",
}

function parsePackId(raw: string | string[] | undefined): CreditPackId {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v && CREDIT_PACK_IDS.includes(v as CreditPackId)) {
    return v as CreditPackId
  }
  return FEATURED_CREDIT_PACK_ID
}

export default async function CreditCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string | string[]; credit_purchase?: string | string[] }>
}) {
  const sp = await searchParams
  const initialPackId = parsePackId(sp.pack)
  const canceledRaw = sp.credit_purchase
  const canceled =
    (Array.isArray(canceledRaw) ? canceledRaw[0] : canceledRaw) === "canceled"
  const packs = getCreditPacksForPublic()

  return (
    <CreditCheckoutClient
      packs={packs}
      initialPackId={initialPackId}
      canceled={canceled}
    />
  )
}
