export type VoiceGroup = "mine" | "default" | "library";

/** Labels for the voice picker, in the order the groups are shown. */
export const VOICE_GROUP_LABELS: Record<VoiceGroup, string> = {
  mine: "Your voices",
  default: "Default voices",
  library: "Voice Library (paid plan only)",
};
