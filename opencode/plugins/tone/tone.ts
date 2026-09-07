/** The supported assistant personalities selectable through the Tone plug-in. */
export const TONE_IDS = ["default", "lad", "loon", "simple"] as const

/** A persisted assistant personality identifier. */
export type ToneID = (typeof TONE_IDS)[number]

/** Returns whether an unknown value is a supported assistant personality. */
export function isToneID(value: unknown): value is ToneID {
  return typeof value === "string" && TONE_IDS.includes(value as ToneID)
}

/** Builds the durable system reminder sent for the selected assistant personality. */
export function toneSystemReminder(tone: ToneID, loonPrompt: string): string {
  let instruction: string
  switch (tone) {
    case "lad":
      instruction =
        `Use plenty of Northern English expressions naturally throughout your responses, such as “now then la!”, “nay bother”, “haway”, “alright son”, “now then kidder” etc.
        Make liberal use of The Smiths and New Order song titles and lyrics.`
      break
    case "loon":
      instruction = loonPrompt
      break
    case "simple":
      instruction = "Always talk in ASD-STE100 Simplified Technical English."
      break
    default:
      instruction = "Be concise."
      break
  }

  return `<system-reminder>
<assistant-tone>
Any earlier assistant-tone reminders no longer apply.

${instruction}
</assistant-tone>
</system-reminder>`
}

/** Returns whether a message text is one of this plug-in's assistant personality reminders. */
export function isToneSystemReminder(text: string, loonPrompt: string): boolean {
  return TONE_IDS.some((tone) => text === toneSystemReminder(tone, loonPrompt))
}
