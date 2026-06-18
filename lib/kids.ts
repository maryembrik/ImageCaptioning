/**
 * Tone classification + child-friendly caption rewriting.
 *
 * No external API — purely rule-based, instant, offline. Good enough for a
 * live demo and completely defensible to explain: lexicon-based sentiment
 * detection (Hu & Liu 2004 style) + lexical substitution.
 */

export type Tone =
  | "happy"
  | "sad"
  | "calm"
  | "energetic"
  | "scary"
  | "neutral";

const TONE_LEXICON: Record<Exclude<Tone, "neutral">, string[]> = {
  happy: [
    "smiling", "smile", "playing", "laughing", "laugh", "joyful", "happy",
    "fun", "celebrating", "celebration", "party", "bright", "sunny", "sun",
    "colorful", "beautiful", "cute", "adorable", "lovely", "kid", "kids",
    "child", "children", "baby", "puppy", "kitten", "flowers", "wedding",
    "birthday", "cake", "ice", "cream",
  ],
  sad: [
    "crying", "cry", "sad", "alone", "lonely", "empty", "abandoned", "tear",
    "tears", "sitting alone", "old", "tired", "homeless", "lost", "missing",
  ],
  scary: [
    "dark", "shadow", "blood", "bloody", "knife", "gun", "weapon", "weapons",
    "fire", "burning", "burned", "destroyed", "broken", "skull", "skeleton",
    "fight", "fighting", "punching", "kick", "kicking", "screaming",
    "scream", "smoke", "smoking", "war", "explosion", "dirty",
  ],
  energetic: [
    "running", "run", "racing", "race", "jumping", "jump", "leaping",
    "skating", "skateboard", "biking", "cycling", "speeding", "flying",
    "surfing", "diving", "playing", "sports", "ball", "soccer", "basketball",
    "throwing", "throw", "catching", "catch", "dancing", "dance",
  ],
  calm: [
    "sleeping", "sleep", "sitting", "resting", "rest", "still", "quiet",
    "peaceful", "calm", "relaxing", "lying", "looking", "watching",
    "reading", "thinking", "standing",
  ],
};

const TONE_EMOJI: Record<Tone, string> = {
  happy: "😄",
  sad: "😔",
  calm: "🌿",
  energetic: "⚡",
  scary: "😨",
  neutral: "🙂",
};

const TONE_COLOR: Record<Tone, string> = {
  happy: "#F59E0B",     // amber
  sad: "#60A5FA",       // blue
  calm: "#10B981",      // emerald
  energetic: "#EF4444", // red
  scary: "#A78BFA",     // violet
  neutral: "#94A3B8",   // slate
};

/* ─── Tone prediction ──────────────────────────────────────────────────── */

export type ToneResult = {
  tone: Tone;
  emoji: string;
  color: string;
  confidence: number; // 0..1
  evidence: string[]; // matched words
  distribution: Record<Tone, number>;
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`(){}\[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function predictTone(caption: string): ToneResult {
  const words = tokenize(caption);
  const dist: Record<Tone, number> = {
    happy: 0, sad: 0, calm: 0, energetic: 0, scary: 0, neutral: 0,
  };
  const evidence: string[] = [];
  for (const w of words) {
    for (const [tone, lex] of Object.entries(TONE_LEXICON) as [
      Exclude<Tone, "neutral">,
      string[]
    ][]) {
      if (lex.includes(w)) {
        dist[tone]++;
        evidence.push(w);
      }
    }
  }
  // Pick the tone with the highest score; default to neutral on tie/none.
  let winner: Tone = "neutral";
  let best = 0;
  (Object.keys(dist) as Tone[]).forEach((t) => {
    if (t === "neutral") return;
    if (dist[t] > best) {
      best = dist[t];
      winner = t;
    }
  });
  if (best === 0) winner = "neutral";

  // Normalize distribution to percentages
  const total = Math.max(
    1,
    Object.values(dist).reduce((a, b) => a + b, 0)
  );
  const normalized: Record<Tone, number> = { ...dist };
  (Object.keys(normalized) as Tone[]).forEach((k) => {
    normalized[k] = dist[k] / total;
  });
  if (best === 0) normalized.neutral = 1;

  return {
    tone: winner,
    emoji: TONE_EMOJI[winner],
    color: TONE_COLOR[winner],
    confidence: best === 0 ? 0.5 : Math.min(1, best / 3),
    evidence: Array.from(new Set(evidence)),
    distribution: normalized,
  };
}

/* ─── Child-friendly rewriter ──────────────────────────────────────────── */

/**
 * Word-level substitutions: scary/negative → softer kid-friendly equivalents.
 * Order matters — replace multi-word phrases first.
 */
const SUBSTITUTIONS: Array<[RegExp, string]> = [
  // Multi-word phrases first (longest match wins)
  [/\bblack\s+and\s+white\b/gi, "vintage style"],
  [/\bdirty\s+bathroom\b/gi, "messy bathroom"],
  // Scary / violent / negative single words
  [/\bdirty\b/gi, "messy"],
  [/\bdark\b/gi, "cozy"],
  [/\bbroken\b/gi, "old"],
  [/\bdestroyed\b/gi, "old"],
  [/\bcrying\b/gi, "looking sad"],
  [/\bdead\b/gi, "sleeping"],
  [/\bblood\b/gi, "ketchup"],
  [/\bbloody\b/gi, "messy"],
  [/\bknife\b/gi, "spoon"],
  [/\bweapon\b/gi, "tool"],
  [/\bweapons\b/gi, "tools"],
  [/\bgun\b/gi, "water toy"],
  [/\bfight\b/gi, "play"],
  [/\bfighting\b/gi, "playing together"],
  [/\bkill\b/gi, "tag"],
  [/\bsmoking\b/gi, "breathing"],
  [/\bcigarette\b/gi, "straw"],
  [/\bdrunk\b/gi, "silly"],
  [/\bnaked\b/gi, "in pajamas"],
  [/\bold\b/gi, "wise"],
  [/\bugly\b/gi, "funny-looking"],
  [/\bskull\b/gi, "head"],
  [/\bskeleton\b/gi, "bones"],
  [/\bfire\b/gi, "warm light"],
  [/\bburning\b/gi, "glowing"],
];

const OPENERS = [
  "Look! ",
  "Wow — ",
  "Hey kiddo, see this — ",
  "Guess what! ",
  "Check it out — ",
];

const ENDINGS = [
  " — how cool is that!",
  "! Isn't that nice?",
  "! 🌟",
  " — let's go explore!",
  ". Doesn't that look fun?",
];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

/** Replace bad words, soften, add cheerful framing + emoji. */
export function rewriteForKids(caption: string): string {
  if (!caption || !caption.trim()) return "";
  let s = caption.trim();

  // Apply substitutions
  for (const [pat, rep] of SUBSTITUTIONS) {
    s = s.replace(pat, rep);
  }

  // Strip leading "a " / "an " / "the " so the opener flows
  s = s.replace(/^(a|an|the)\s+/i, "");

  // Lowercase first letter (the opener brings its own capital)
  s = s[0].toLowerCase() + s.slice(1);

  return pick(OPENERS) + s + pick(ENDINGS);
}
