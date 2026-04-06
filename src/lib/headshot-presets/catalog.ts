/**
 * Preset talking-head images loaded via our proxy from Wikimedia Commons (HTTPS only, host allowlisted).
 * You are responsible for how you use generated content; replace URLs if a file moves on Commons.
 */
export interface HeadshotPreset {
  id: string
  displayName: string
  /** Full HTTPS URL on upload.wikimedia.org */
  imageUrl: string
}

export const HEADSHOT_PRESETS: HeadshotPreset[] = [
  {
    id: "donald-trump",
    displayName: "Donald Trump",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/53/Donald_Trump_official_portrait_%28cropped%29.jpg",
  },
  {
    id: "barack-obama",
    displayName: "Barack Obama",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg",
  },
  {
    id: "abraham-lincoln",
    displayName: "Abraham Lincoln",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg",
  },
  {
    id: "george-washington",
    displayName: "George Washington",
    /** Stuart portrait — use 330px thumb; full file is ~18MB and exceeds proxy limits. */
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg/330px-Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg",
  },
  {
    id: "andrew-tate",
    displayName: "Andrew Tate",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a5/Andrew_Tate_-_James_Tamim_Upload_%28Cropped_Wide_Portrait%29.png",
  },
  {
    id: "tristan-tate",
    displayName: "Tristan Tate",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Tristan_Tate_2025.png",
  },
  {
    id: "david-goggins",
    displayName: "David Goggins",
    /** Official-style frontal portrait (U.S. Navy), not the side/profile race photo. */
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/David_A._Goggins.jpg/330px-David_A._Goggins.jpg",
  },
  {
    id: "benjamin-netanyahu",
    displayName: "Benjamin Netanyahu",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/87/Benjamin_Netanyahu%2C_January_2024.jpg",
  },
  {
    id: "vladimir-putin",
    displayName: "Vladimir Putin",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/2c/Vladimir_Putin_delivering_a_speech_at_the_2021_St._Petersburg_International_Economic_Forum_%28cropped%29.jpg",
  },
  {
    id: "kim-jong-un",
    displayName: "Kim Jong Un",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Kim_Jong-un_2019_%28cropped%29.jpg",
  },
  {
    id: "joe-biden",
    displayName: "Joe Biden",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg",
  },
  {
    id: "elon-musk",
    displayName: "Elon Musk",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg",
  },
]
