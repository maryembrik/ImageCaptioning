/**
 * Ollama client — calls a local Llama model running via Ollama.
 *
 *   1. Start Ollama on your machine and pull the model:
 *        ollama pull llama3.2
 *        ollama serve   (usually auto-starts)
 *
 *   2. (only if calls fail with CORS) tell Ollama to accept browser requests
 *      from your dev origin:
 *        # PowerShell
 *        $env:OLLAMA_ORIGINS = "*" ; ollama serve
 *
 *   3. Optionally pin a model name in .env.local:
 *        NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
 *        NEXT_PUBLIC_OLLAMA_MODEL=llama3.2
 *
 * Every helper is best-effort — it throws on failure so the caller can fall
 * back to rule-based output (we never want a broken demo).
 */

export const OLLAMA_URL =
  process.env.NEXT_PUBLIC_OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? "llama3.2:3b";

export type OllamaOptions = {
  /** Sampling temperature (0..1). Lower = more deterministic. */
  temperature?: number;
  /** Max tokens to predict. */
  num_predict?: number;
  /** Stop sequences. */
  stop?: string[];
};

/* ─── Health check (cached) ─────────────────────────────────────────────── */

let _isAvailable: boolean | null = null;
let _checkPromise: Promise<boolean> | null = null;

export async function isOllamaAvailable(): Promise<boolean> {
  if (_isAvailable !== null) return _isAvailable;
  if (_checkPromise) return _checkPromise;
  _checkPromise = (async () => {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`, { method: "GET" });
      _isAvailable = r.ok;
    } catch {
      _isAvailable = false;
    }
    return _isAvailable!;
  })();
  return _checkPromise;
}

/** Reset the cache (use after the user starts Ollama mid-session). */
export function resetOllamaCheck() {
  _isAvailable = null;
  _checkPromise = null;
}

/* ─── Core generate ─────────────────────────────────────────────────────── */

export class LlamaError extends Error {}

async function generate(prompt: string, opts: OllamaOptions = {}): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.num_predict ?? 256,
        stop: opts.stop,
      },
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new LlamaError(`Ollama returned ${r.status}: ${txt.slice(0, 200)}`);
  }
  const json = await r.json();
  return (json.response ?? "").trim();
}

/* ─── Task-specific helpers ─────────────────────────────────────────────── */

/**
 * Rewrite an image caption into a warm, child-friendly one-liner.
 * Replaces scary/negative words and adds a cheerful framing.
 */
export async function kidFriendlyCaption(caption: string): Promise<string> {
  if (!caption.trim()) return "";
  const prompt = `You are a friendly children's book author writing for a 5-year-old.

Rewrite the image caption below in one short sentence (max 22 words). Use simple, cheerful, warm language. Replace any scary, dark, dirty, or negative words with kid-safe alternatives. Do not invent objects that aren't in the original caption. Add a tiny bit of wonder.

Reply with ONLY the rewritten sentence — no quotes, no explanations, no labels.

Caption: ${caption}

Rewritten:`;
  const out = await generate(prompt, { temperature: 0.5, num_predict: 80 });
  return cleanupOneLiner(out);
}

/**
 * Generate a short bedtime story (~120 words) inspired by an image caption.
 * Tunable by audience age and a vibe theme.
 */
export type StoryTheme = "calm" | "adventure" | "magical" | "funny";

export async function bedtimeStory(
  caption: string,
  age: number = 5,
  theme: StoryTheme = "calm"
): Promise<string> {
  if (!caption.trim()) return "";
  const themeHint: Record<StoryTheme, string> = {
    calm: "soothing, peaceful, and gentle — perfect for falling asleep",
    adventure: "lightly adventurous with a friendly hero — but ending peacefully",
    magical: "whimsical and magical with tiny enchantments — ending with a sleepy spell",
    funny: "playful and silly with a little humor — ending with a cozy yawn",
  };
  const prompt = `You are a beloved children's bedtime-story author.

Write a short bedtime story for a ${age}-year-old, inspired by the scene below. Tone: ${themeHint[theme]}. The story must be 90–140 words. Use very simple language. No scary content, no violence, no sad endings. End on a soft, sleepy line that invites the child to close their eyes.

Scene: ${caption}

Reply with ONLY the story — no title, no preface, no bullet list, no markdown.

Story:`;
  const out = await generate(prompt, { temperature: 0.85, num_predict: 320 });
  // Strip any accidental "Story:" prefix
  return out.replace(/^\s*(story|here'?s?( the)? story)\s*:?\s*/i, "").trim();
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function cleanupOneLiner(s: string): string {
  // Remove surrounding quotes / brackets, collapse whitespace, trim.
  let out = s.trim();
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim();
  }
  // Take only the first non-empty line in case Llama got verbose.
  const firstLine = out.split(/\r?\n/).find((l) => l.trim().length > 0);
  return (firstLine ?? out).trim();
}


/* ─── Chat (CaptionAI assistant) ───────────────────────────────────────── */

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

/**
 * System prompt — gives the chatbot full context about the DataMinds project
 * and team, so it can answer "who built this", "how does soft attention work",
 * "what's BLEU-4", etc. Kept short to leave room for conversation history.
 */
const SYSTEM_PROMPT = `You are the CaptionAI assistant, a friendly chatbot inside a deep-learning demo site.

PROJECT:
- Site: CaptionAI by team DataMinds (ESPRIT 4DS, 2026 paper-reproduction project).
- We reproduced "Show, Attend and Tell" (Xu et al., ICML 2015) — a soft-attention LSTM image-captioning model.
- We trained 3 architectures (Model 1 = Soft Attention, Model 2 = No-Attention baseline, Model 3 = Transformer decoder) on 3 datasets (Flickr8k, Flickr30k, MS COCO).
- Our best results (test BLEU-4): Flickr8k 22.0 (matches paper 21.3), Flickr30k 19.5, MS COCO 26.51 (beats paper 25.0).
- The site has 8 interactive tabs: Accessibility (voice+camera+TTS for blind users), Multi-Model Battle, Spot-the-AI Turing test, Attention heat-map explorer, Caption Quiz with real BLEU scoring, Multilingual EN/FR/AR, Kids Mode (you rewrite captions for children), and Bedtime Story (you write stories).

TEAM (DataMinds):
- Amine Manai — encoder + ResNet
- Ines Chtioui — attention + LSTM
- Maha Aloui — training + evaluation
- Malek Chairat — UI + Gradio
- Mariem Fersi — YOLO + GPT-2 extensions

EXTRAS:
- Liu & Brailsford 2023 error analysis (POS-tag based hallucination detection).
- YOLO + GPT-2 caption correction post-processing.
- CLIPScore evaluation — our personal touch, reference-free image-text alignment metric (Hessel et al. EMNLP 2021).
- Cartoonify tab — sends the photo through a free Hugging Face cartoonization Space (White-box / AnimeGAN), then captions BOTH versions to study domain shift.
- Kids Mode & Bedtime Story — both powered by you (Llama 3.2 3B running locally on Ollama).

OUR TEACHER (course supervisor — Deep Learning):
- Full name: **Dr Sonia Mesbah** (Sonia).
- Role: **Head of the Pedagogical Unit (Ingénierie Logiciel)** at ESPRIT — covers Software Engineering, Data Science, and Business Intelligence tracks.
- Headline: Data Scientist · IT Trainer · Scrum Master · Agile Coach.
- Background: PhD in Computer Science from ENSI (National School of Computer Sciences, Tunisia) — thesis on 3D video coding & computer vision. Engineering + research master's from ENI Sousse (Intelligent Communicating Systems).
- Career: 15+ years of experience, first role since 2010. Based in Tunisia. Currently leads the pedagogical unit since January 2025.
- Top technical skills: Leadership, MLflow, Prompt Engineering, Large Language Models, Explainable AI (XAI), MLOps, Power BI, Agile/Scrum, Conversational AI, team management.
- Public profile: https://www.linkedin.com/in/drsoniamesbah/
- She supervises this paper-reproduction project (Show, Attend and Tell) and gave us permission to subsample COCO/Flickr30k due to GPU constraints — that's why our COCO uses a 20K-image subset.
- If asked "who is my teacher / our teacher / our supervisor", answer with these facts, warmly but professionally.

STYLE:
- Warm, concise, technically accurate. 1-3 sentences typically. Use plain English.
- If asked about something not in the project, answer briefly but stay friendly.
- Never invent fake numbers about the project. Use the ones above.
- Never claim to see the image — you only see text.`;

/** Call the chat endpoint with full message history. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  // Prepend system message if none provided
  const withSystem: ChatMessage[] =
    messages[0]?.role === "system"
      ? messages
      : [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: withSystem,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 256,
      },
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new LlamaError(`Ollama /api/chat returned ${r.status}: ${txt.slice(0, 200)}`);
  }
  const json = await r.json();
  return (json.message?.content ?? "").trim();
}
