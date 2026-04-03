import type { VoicePreset } from "./types"

const DEMO_REF = {
  refAudioUrl: "/voice-presets/demo-ref.wav",
  refText: "",
} as const

function h(n: number): string {
  const i = ((n - 1) % 16) + 1
  return `/voice-presets/avatars/h-${i.toString().padStart(2, "0")}.svg`
}

function envKeyFromPresetId(id: string): string {
  return `VOICE_PRESET_${id.replace(/-/g, "_").toUpperCase()}_PROVIDER_ID`
}

function vpc(
  id: string,
  label: string,
  tagline: string,
  placeholder: string,
  categoryId: string,
  sortOrder: number,
  avatarN: number
): VoicePreset {
  return {
    id,
    label,
    tagline,
    placeholder,
    imageSrc: h(avatarN),
    defaultSpeakerLabel: label,
    categoryId,
    status: "active",
    providerVoiceIdEnv: envKeyFromPresetId(id),
    sortOrder,
    ...DEMO_REF,
  }
}

/**
 * Preset roster matches `characters.md`. Each active preset resolves its ElevenLabs
 * voice id from the matching `VOICE_PRESET_*` env var.
 */
export const VOICE_PRESET_ENTRIES: VoicePreset[] = [
  // —— White ——
  vpc(
    "rw-chris",
    "Chris",
    "Your common American average man",
    "Here is the update, straight to the point, no fluff.",
    "race-white",
    1,
    1
  ),
  vpc(
    "rw-stacy",
    "Stacy",
    "Like totally your valley girl",
    "Oh my god, this is literally the best twist ever.",
    "race-white",
    2,
    2
  ),
  vpc(
    "rw-billy",
    "Billy",
    "Your average British bloke",
    "Right then, let us keep this simple and move on.",
    "race-white",
    3,
    3
  ),
  vpc(
    "rw-susan",
    "Susan",
    "Your average British lady",
    "Before we go on, a quick word on what actually matters.",
    "race-white",
    4,
    4
  ),
  vpc(
    "rw-vladimir",
    "Vladimir",
    "Mysterious Russian guy",
    "The answer is simpler than people want to believe.",
    "race-white",
    5,
    5
  ),
  vpc(
    "rw-tatianna",
    "Tatianna",
    "Russian traditional girl",
    "Listen closely, the story begins in one small detail.",
    "race-white",
    6,
    6
  ),
  vpc(
    "rw-antonio",
    "Antonio",
    "Italian grumpy grandpa",
    "In my day we did not need an app for common sense.",
    "race-white",
    7,
    7
  ),
  vpc(
    "rw-larauque",
    "LaRauque",
    "Bonjour French man",
    "A small pause, then we continue with clarity.",
    "race-white",
    8,
    8
  ),
  vpc(
    "rw-chloe",
    "Chloe",
    "Soft French girl",
    "Stay gentle with the pacing, it lands better that way.",
    "race-white",
    9,
    9
  ),

  // —— Black ——
  vpc(
    "rb-demarcus",
    "Demarcus",
    "Urban Black American",
    "Real talk, this one hits cleaner than people expected.",
    "race-black",
    1,
    5
  ),
  vpc(
    "rb-tonya",
    "Tonya",
    "Energetic Black girl",
    "Listen, this is exactly how the clip should hit.",
    "race-black",
    2,
    6
  ),
  vpc(
    "rb-derrick",
    "Derrick",
    "Middle-aged Black man",
    "Context first, then we get to the payoff.",
    "race-black",
    3,
    7
  ),
  vpc(
    "rb-ms-harris",
    "Ms. Harris",
    "Middle-aged Black woman",
    "Let us anchor on facts before we spiral.",
    "race-black",
    4,
    8
  ),
  vpc(
    "rb-ayinde",
    "Ayinde",
    "Kind African gentleman",
    "Take a breath, we handle this step by step.",
    "race-black",
    5,
    9
  ),
  vpc(
    "rb-ololade",
    "Ololade",
    "Kind African grandma",
    "Child, the truth is usually in the small things.",
    "race-black",
    6,
    10
  ),

  // —— Asian ——
  vpc(
    "ra-jay",
    "Jay",
    "Average Chinese man",
    "Objectively speaking, the pacing here works.",
    "race-asian",
    1,
    10
  ),
  vpc(
    "ra-ziyu",
    "Ziyu",
    "Average Chinese lady",
    "Welcome in, today we are keeping this super simple.",
    "race-asian",
    2,
    11
  ),
  vpc(
    "ra-asakura",
    "Asakura",
    "Thoughtful Japanese man",
    "Plot twist, this was the intended outcome the whole time.",
    "race-asian",
    3,
    12
  ),

  // —— Indian ——
  vpc(
    "ri-rahul",
    "Rahul",
    "Average Indian man",
    "Here is the one detail everyone keeps missing.",
    "race-indian",
    1,
    13
  ),
  vpc(
    "ri-anika",
    "Anika",
    "Average Indian woman",
    "Before we debate, let us agree on what we know.",
    "race-indian",
    2,
    14
  ),
  vpc(
    "ri-kumaran",
    "Kumaran",
    "Southern Indian man",
    "Three reasons this keeps trending every single week.",
    "race-indian",
    3,
    15
  ),

  // —— Hispanic ——
  vpc(
    "rh-isaac",
    "Isaac",
    "Calm Venezuelan man",
    "Lower the volume, keep the delivery clean.",
    "race-hispanic",
    1,
    16
  ),
  vpc(
    "rh-maria",
    "Maria",
    "Kind Venezuelan woman",
    "This part lands harder when the rhythm is right.",
    "race-hispanic",
    2,
    1
  ),
  vpc(
    "rh-elio",
    "Elio",
    "Calm Spanish man",
    "I tried it once, and now we are here.",
    "race-hispanic",
    3,
    2
  ),
  vpc(
    "rh-luis",
    "Luis",
    "Mexican man",
    "The transition was smooth, then everything exploded.",
    "race-hispanic",
    4,
    3
  ),

  // —— Middle East ——
  vpc(
    "rme-mohammed",
    "Mohammed",
    "Encouraging Arabic man",
    "Trust the process and keep the timing sharp.",
    "race-middle-east",
    1,
    4
  ),
  vpc(
    "rme-salma",
    "Salma",
    "Inviting Arabic woman",
    "Come in, we will walk through this together.",
    "race-middle-east",
    2,
    5
  ),
  vpc(
    "rme-burak",
    "Burak",
    "Confident Turkish man",
    "Without context this clip loses half its power.",
    "race-middle-east",
    3,
    6
  ),

  // —— Jobs ——
  vpc(
    "job-farmer",
    "Farmer",
    "Grounded rural plain-speech",
    "Weather changes fast, like internet trends.",
    "jobs",
    1,
    7
  ),
  vpc(
    "job-it-guy",
    "IT Guy",
    "Tech support confidence",
    "Have you tried restarting your expectations first?",
    "jobs",
    2,
    8
  ),
  vpc(
    "job-crypto-guy",
    "Crypto Guy",
    "Fast market hype",
    "Volatility is a feature, not a bug.",
    "jobs",
    3,
    9
  ),
  vpc(
    "job-billionaire",
    "Billionaire",
    "Calm boardroom assertive",
    "Scale first, optimize second, ship always.",
    "jobs",
    4,
    10
  ),
  vpc(
    "job-lawyer",
    "Lawyer",
    "Formal argument style",
    "For the record, this is exactly what we predicted.",
    "jobs",
    5,
    11
  ),
  vpc(
    "job-doctor",
    "Doctor",
    "Reassuring clinical pace",
    "Breathe, hydrate, and follow the protocol.",
    "jobs",
    6,
    12
  ),

  // —— Tonality ——
  vpc(
    "tone-angry",
    "Angry",
    "High intensity frustration",
    "No, this is exactly what we are not doing today.",
    "tonality",
    1,
    13
  ),
  vpc(
    "tone-crying",
    "Crying",
    "Emotional shaky delivery",
    "I cannot believe this happened again.",
    "tonality",
    2,
    14
  ),
  vpc(
    "tone-joyful",
    "Joyful",
    "Positive bright tone",
    "This is the best possible outcome for today.",
    "tonality",
    3,
    15
  ),
  vpc(
    "tone-sarcastic",
    "Sarcastic",
    "Dry layered irony",
    "Oh wow, another groundbreaking opinion online.",
    "tonality",
    4,
    16
  ),
  vpc(
    "tone-deadpan",
    "Deadpan",
    "Flat affect, low emotion",
    "Cool. Great. Exactly what we needed.",
    "tonality",
    5,
    1
  ),
  vpc(
    "tone-whisper",
    "Whisper",
    "Soft ASMR-like",
    "Lower your voice and keep the pacing tight.",
    "tonality",
    6,
    2
  ),
]
