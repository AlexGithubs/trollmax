interface Props {
  videoUrl: string
}

export function VideoPlayer({ videoUrl }: Props) {
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={videoUrl}
          controls
          playsInline
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  )
}
