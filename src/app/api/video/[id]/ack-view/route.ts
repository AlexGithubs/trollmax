import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { acknowledgeVideoView } from "@/lib/video/unseen-completion"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const ok = await acknowledgeVideoView(user.id, id)
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
