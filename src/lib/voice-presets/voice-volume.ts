export function getVoicePresetVolumeMultiplier(presetId?: string): number {
  if (!presetId) return 1

  // Tune these multipliers as needed.
  // "louder" = noticeable; "slightly louder" = subtle.
  switch (presetId) {
    case "ri-rahul":
      return 2
    case "rh-maria":
      return 1.5
    case "rh-isaac":
      return 1.3
    default:
      return 1
  }
}

