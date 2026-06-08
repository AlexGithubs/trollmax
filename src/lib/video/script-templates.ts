export type ScriptTemplate = {
  id: string
  label: string
  text: string
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "roast",
    label: "Roast",
    text: "Okay listen up — I need to say this once and for all. You think you're built different? You're not. You're built like a participation trophy with Wi-Fi.",
  },
  {
    id: "hype",
    label: "Hype",
    text: "No cap, this is about to be the greatest thing you've seen all week. Lock in, turn your volume up, and tell everyone you know to pull up right now.",
  },
  {
    id: "apology",
    label: "Apology",
    text: "Look, I owe you an apology. I said I'd be back sooner, I ghosted harder than your group chat, and that's on me. Starting fresh — no excuses.",
  },
  {
    id: "birthday",
    label: "Birthday",
    text: "Happy birthday! Another year older, another year wiser — or at least another year of pretending you have your life together. Enjoy your day, legend.",
  },
  {
    id: "hot-take",
    label: "Hot take",
    text: "Unpopular opinion incoming, and I'm not sorry. Everyone's pretending this is fine when it's clearly not. Fight me in the comments if you disagree.",
  },
  {
    id: "announcement",
    label: "Announcement",
    text: "Big news — I've been sitting on this for a minute and it's finally time to share. Drop everything, watch this, and I'll explain what's coming next.",
  },
]
