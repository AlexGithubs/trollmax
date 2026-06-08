import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"

function safeDownloadFilename(title: string): string {
  const base = title.replace(/[^\w\s.-]/g, "").trim().slice(0, 80)
  return base ? `${base}.mp4` : "video.mp4"
}

export function VideoDownloadButton({
  videoId,
  title,
  className,
}: {
  videoId: string
  title: string
  className?: string
}) {
  const href = `/api/video/${videoId}/play?download=1`
  const filename = safeDownloadFilename(title)

  return (
    <Button asChild variant="outline" size="sm" className={cn("gap-1.5", className)}>
      <Link href={href} download={filename}>
        <Download className="h-4 w-4" />
        Download MP4
      </Link>
    </Button>
  )
}
