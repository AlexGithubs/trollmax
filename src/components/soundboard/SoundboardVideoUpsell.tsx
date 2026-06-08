import Link from "next/link"

export function SoundboardVideoUpsell({ href }: { href: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <Link href={href} className="text-foreground/90 hover:underline">
        Turn this into a video
      </Link>
      <span className="text-muted-foreground/70"> · voice carries over, nothing to re-upload</span>
    </p>
  )
}
