export interface VoicePresetCategory {
  id: string
  label: string
  /** Short blurb for filter chips (tooltip). */
  description?: string
  sortOrder: number
}

/** Filter groups shown in preset pickers (order = display order). */
export const VOICE_PRESET_CATEGORIES: VoicePresetCategory[] = [
  {
    id: "race-white",
    label: "White",
    description:
      "American everyday, British, Russian, Italian, and French-styled character voices.",
    sortOrder: 1,
  },
  {
    id: "race-black",
    label: "Black",
    description: "Urban American, middle-aged, and African-styled character voices.",
    sortOrder: 2,
  },
  {
    id: "race-asian",
    label: "Asian",
    description: "Chinese and Japanese-styled character voices.",
    sortOrder: 3,
  },
  {
    id: "race-indian",
    label: "Indian",
    description: "North and South Indian-styled character voices.",
    sortOrder: 4,
  },
  {
    id: "race-hispanic",
    label: "Hispanic",
    description: "Venezuelan, Spanish, and Mexican-styled character voices.",
    sortOrder: 5,
  },
  {
    id: "race-middle-east",
    label: "Middle East",
    description: "Arabic and Turkish-styled character voices.",
    sortOrder: 6,
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "Archetypes by profession: farmer, tech, finance, law, medicine, and more.",
    sortOrder: 7,
  },
  {
    id: "tonality",
    label: "Tonality",
    description: "Emotional delivery: angry, crying, joyful, sarcastic, deadpan, whisper.",
    sortOrder: 8,
  },
]
