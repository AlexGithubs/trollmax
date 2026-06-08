import type { SoundboardManifest } from "./types"

export type ManifestStatus = "draft" | "processing" | "complete" | "failed"

export const MANIFEST_STATUS_BADGE: Record<
  ManifestStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-yellow-500/20 text-yellow-600" },
  complete: { label: "Complete", className: "bg-green-500/20 text-green-600" },
  failed: { label: "Failed", className: "bg-destructive/20 text-destructive" },
}

export function resolveSoundboardStatus(
  manifest: Pick<SoundboardManifest, "status" | "clips">
): ManifestStatus {
  return manifest.status ?? (manifest.clips?.length ? "complete" : "draft")
}
