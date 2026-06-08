"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatCreditBadgeAmount } from "@/lib/billing/currency-display"
import { CreditInsufficientPaywall } from "./CreditInsufficientPaywall"

type Props = {
  product: "video" | "soundboard"
  balance: number
  required: number
  manifestId: string
  returnPath: string
  onBack: () => void
  alternateHref: string
  alternateLabel: string
}

export function CreditGateScreen({
  product,
  balance,
  required,
  manifestId,
  returnPath,
  onBack,
  alternateHref,
  alternateLabel,
}: Props) {
  const savedLabel = product === "video" ? "video" : "soundboard"
  const shortfall = Math.max(0, Math.round((required - balance) * 10) / 10)
  const shortfallLabel = shortfall === 1 ? "credit" : "credits"

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            You&apos;re {formatCreditBadgeAmount(shortfall)} {shortfallLabel} short
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This {savedLabel} costs{" "}
            <span className="font-medium text-foreground">
              {formatCreditBadgeAmount(required)} credits
            </span>
            . You have{" "}
            <span className="font-medium text-foreground">
              {formatCreditBadgeAmount(balance)}
            </span>
            . Your work is saved — nothing was generated yet.
          </p>
        </div>

        <CreditInsufficientPaywall
          product={product}
          balance={balance}
          required={required}
          manifestId={manifestId}
          returnPath={returnPath}
        />

        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Back to editor
          </Button>
          <p>
            <button
              type="button"
              onClick={onBack}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              Edit to use fewer credits
            </button>
            <span className="mx-2 text-border">·</span>
            <Link
              href={alternateHref}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {alternateLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
