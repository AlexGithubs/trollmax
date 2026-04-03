interface Props {
  videoUrl: string
  /** When set, Vercel Blob URLs are played through `/api/video/[id]/play` (required for private blobs). */
  videoId?: string
}

export function VideoPlayer({ videoUrl, videoId }: Props) {
  const useProxy =
    Boolean(videoId) &&
    videoUrl.includes("blob.vercel-storage.com")
  const src = useProxy ? `/api/video/${videoId}/play` : videoUrl

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={src}
          controls
          playsInline
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  )
}
