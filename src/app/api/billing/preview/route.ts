import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { isBillingAdmin } from "@/lib/billing/admin"
import {
  BILLING_PREVIEW_COOKIE,
  type BillingPreviewMode,
} from "@/lib/billing/preview"

const BodySchema = z.object({
  mode: z.enum(["actual", "free", "pro"]),
})

function previewCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  }
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isBillingAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const mode = parsed.data.mode as BillingPreviewMode
  const res = NextResponse.json({ ok: true as const, mode })

  if (mode === "actual") {
    res.cookies.delete(BILLING_PREVIEW_COOKIE)
  } else {
    res.cookies.set(BILLING_PREVIEW_COOKIE, mode, previewCookieOptions())
  }

  return res
}
