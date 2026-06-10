import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { listUnseenReadyVideos } from "@/lib/video/unseen-completion"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const videos = await listUnseenReadyVideos(user.id)
  return NextResponse.json({ videos })
}
