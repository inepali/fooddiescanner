// Words and phrases that read as a factual accusation about a named product or brand
// (safety, legality, deception, disease) rather than an opinion about an ingredient list.
// Used by the script, caption and label prompts, and checked in code on everything the
// model writes, so they never reach a voiceover, caption or public report page.

type Rule = { re: RegExp; label: string; instead: string };

const RULES: Rule[] = [
  { re: /\b(harm(?:ful|s)?|toxic(?:ity)?|toxins?|poison(?:ous)?|dangerous|danger|unsafe|deadly|lethal)\b/i, label: "safety claim", instead: "describe what the ingredient is and what it does" },
  { re: /\b(carcinogen(?:ic)?s?|cancers?|diabet(?:es|ic)|obesity|heart disease|stroke|alzheimer'?s|adhd|hyperactiv\w*|inflammat\w*|disease)\b/i, label: "disease claim", instead: "use a general nutrition point, such as guidance to limit added sugar or sodium" },
  { re: /\b(linked to|causes?|caused by)\b/i, label: "cause-and-effect health claim", instead: "say what nutrition guidelines suggest, with \"may\"" },
  { re: /\bspikes?\s+(?:your\s+)?blood sugar\b/i, label: "health effect claim", instead: "say it is a fast-digesting carbohydrate" },
  { re: /\b(banned|illegal|outlawed|restricted)\b/i, label: "legal or regulatory claim", instead: "leave regulation out" },
  { re: /\b(hid(?:e|es|den|ing)|sneak(?:y|ier|ily|s)?|trick(?:s|y|ing|ed)?|lying|lies to|mislead(?:ing|s)?|deceptive|deceiv\w*|scam|fake|undisclosed|secret)\b/i, label: "suggests the brand is deceiving people", instead: "describe the label neutrally (\"listed as\", \"the front says\")" },
  { re: /\b(junk|garbage|trash|gross|disgusting|nasty|fake food)\b/i, label: "disparaging word", instead: "use the score words: higher-scoring, lower-scoring" },
  { re: /\b(petroleum[- ]derived|petroleum|chemically (?:altered|modified)|lab[- ]made)\b/i, label: "loaded description", instead: "say \"synthetic\" or \"modified\" and what it is used for" },
  { re: /\b(avoid(?:ing)?|stop (?:buying|eating|drinking)|don'?t (?:buy|eat|drink)|never (?:buy|eat|drink)|throw (?:it|them|this) (?:out|away)|boycott|think twice)\b/i, label: "tells people not to buy", instead: "leave the choice to the viewer" },
  { re: /\b(worst|red flags?|i'?d worry|offenders?|culprits?|villains?)\b/i, label: "ranking word that sounds like an accusation", instead: "say \"lowest-scoring\" or \"scored lowest\"" },
  { re: /\bwhat'?s (?:really )?hiding\b|\bwait (?:until|till) you hear\b|\bwhat'?s really in\b/i, label: "implies something is concealed", instead: "tease with \"the lowest score is coming up\"" },
];

export type RiskyHit = { phrase: string; label: string; instead: string };

/** Every risky phrase in the text, once each. */
export function riskyTerms(text: string): RiskyHit[] {
  const hits: RiskyHit[] = [];
  const seen = new Set<string>();
  for (const r of RULES) {
    const re = new RegExp(r.re.source, "gi");
    for (const m of text.matchAll(re)) {
      const phrase = m[0].toLowerCase();
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      hits.push({ phrase, label: r.label, instead: r.instead });
    }
  }
  return hits;
}

/** "harmful" (safety claim: describe what the ingredient is…); "worst" (…) — for a retry note to the model. */
export function describeHits(hits: RiskyHit[]): string {
  return hits.map((h) => `"${h.phrase}" (${h.label}; instead, ${h.instead})`).join("; ");
}

/** Drops every sentence that contains a risky phrase. Last resort when retries didn't fix it. */
export function dropRiskySentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  return sentences.filter((s) => riskyTerms(s).length === 0).join("").replace(/\s+/g, " ").trim();
}

/** An ingredient note that is safe to show or pass on, or null if it isn't. */
export function safeReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return riskyTerms(reason).length ? null : reason;
}

/** The wording rules for every prompt that writes public text about a named product. */
export const WORDING_RULES = `WORDING RULES (legal: these protect us when we name real brands)
- This is an educational opinion about an ingredient list, not a fact about the product or the company. Use opinion and score words: "scored lower", "lowest-scoring", "in my book", "by our rubric".
- Inform, don't accuse. For each ingredient you mention, say what it is in plain words, what it does in this product (sweetener, thickener, emulsifier, preservative, color, flavor, fortification), where it sits on the label, and, if useful, one widely accepted nutrition point (for example "US dietary guidelines suggest limiting added sugars", "this adds sodium", "a refined starch with little fiber"). Use "may" and "can" for anything about health.
- Never use these words or ideas: harmful, toxic, poison, dangerous, unsafe; cancer, diabetes, obesity, heart disease, ADHD, inflammation or any other disease; "linked to", "causes"; "spikes blood sugar"; banned, illegal, restricted; hidden, hiding, sneaky, tricks, misleading, fake, undisclosed, secret; junk, garbage, gross; petroleum-derived, chemically altered; avoid, stop buying, don't buy, throw it out, think twice; worst, red flag, offenders, "I'd worry"; "what's hiding", "wait until you hear", "what's really in".
- Front-of-pack claims are quoted neutrally ("the front says 'natural'") and compared with the ingredient list, never called false.
- Never tell people what to buy or not to buy. A "look for" tip is about label rules, never a brand.
- Vitamins, supplements and products for children: describe each ingredient's purpose only, make no health-effect claims at all, and suggest asking a doctor or pharmacist about supplements.`;
