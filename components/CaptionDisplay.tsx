"use client";

import { useEffect, useRef, useState } from "react";
import { translate } from "@/lib/translate";

export type CapLang = "en" | "fr" | "ar";

const LANG_INFO: Record<CapLang, { code: string; flag: string }> = {
  en: { code: "en-US", flag: "🇬🇧" },
  fr: { code: "fr-FR", flag: "🇫🇷" },
  ar: { code: "ar-SA", flag: "🇹🇳" },
};

/* ─── Voice utilities ──────────────────────────────────────────────────── */

let _cachedVoices: SpeechSynthesisVoice[] = [];
function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (_cachedVoices.length === 0) {
    _cachedVoices = window.speechSynthesis.getVoices();
  }
  return _cachedVoices;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    _cachedVoices = window.speechSynthesis.getVoices();
  };
}

function pickVoice(langCode: string): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (voices.length === 0) return null;
  const base = langCode.split("-")[0];
  return (
    voices.find((v) => v.lang === langCode) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}

function hasVoiceFor(langCode: string): boolean {
  const voices = loadVoices();
  if (voices.length === 0) return false;
  const base = langCode.split("-")[0];
  return voices.some((v) => v.lang.toLowerCase().startsWith(base));
}

/**
 * Play `text` aloud in the requested language.
 *
 * 1. Tries the browser's built-in speech synthesis (best quality, offline).
 * 2. Falls back to Google Translate's TTS endpoint (returns MP3) when the
 *    user's OS doesn't have a voice for that language — common for Arabic on
 *    French/English Windows installs.
 * Returns a Promise that resolves when playback finishes (or errors silently).
 */
export async function speakText(text: string, lang: CapLang = "en"): Promise<void> {
  if (!text || typeof window === "undefined") return;
  const langCode = LANG_INFO[lang].code;

  // Try native speech synthesis if we have a matching voice
  if ("speechSynthesis" in window && hasVoiceFor(langCode)) {
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langCode;
      const v = pickVoice(langCode);
      if (v) u.voice = v;
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      // Safety: resolve after expected duration (some browsers never fire 'end')
      setTimeout(resolve, Math.max(2000, text.length * 90));
    });
  }

  // Fallback: Google Translate TTS endpoint — works for AR/FR/EN even when
  // the OS doesn't have a voice installed.
  try {
    const url =
      "https://translate.google.com/translate_tts?" +
      new URLSearchParams({
        ie: "UTF-8",
        q: text.slice(0, 200),
        tl: lang,
        client: "tw-ob",
      });
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  } catch {
    /* swallow */
  }
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function CaptionDisplay({
  text,
  className,
  showSpeak = true,
  compact = false,
}: {
  text: string;
  className?: string;
  showSpeak?: boolean;
  compact?: boolean;
}) {
  const [lang, setLang] = useState<CapLang>("en");
  const [translations, setTranslations] = useState<Partial<Record<CapLang, string>>>({
    en: text,
  });
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Reset everything if the source text changes
  useEffect(() => {
    setTranslations({ en: text });
    setLang("en");
  }, [text]);

  const ensureLang = async (target: CapLang) => {
    if (!text) return;
    if (translations[target]) {
      setLang(target);
      return;
    }
    setBusy(true);
    try {
      const t = await translate(text, "en", target);
      setTranslations((prev) => ({ ...prev, [target]: t }));
      setLang(target);
    } catch {
      setLang("en");
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    const out = translations[lang] || (lang === "en" ? text : "");
    if (!out || speaking) return;
    setSpeaking(true);
    try {
      await speakText(out, lang);
    } finally {
      setSpeaking(false);
    }
  };

  const shown = translations[lang] || (lang === "en" ? text : "");

  return (
    <div className={className}>
      {busy && lang !== "en" ? (
        <div style={{ marginTop: 6 }}>
          <span className="skel w90"></span>
          <span className="skel w70"></span>
        </div>
      ) : (
        <div
          className={"cap-text" + (lang === "ar" ? " ar" : "")}
          style={compact ? { fontSize: 14, marginTop: 0 } : undefined}
        >
          {shown || (
            <span style={{ color: "var(--text-3)" }}>Caption will appear here.</span>
          )}
        </div>
      )}
      <div className="cap-langbar">
        {(["en", "fr", "ar"] as CapLang[]).map((L) => (
          <button
            key={L}
            type="button"
            className={"ds-pill mini" + (lang === L ? " on" : "")}
            onClick={() => ensureLang(L)}
            disabled={!text || busy}
            title={`Translate to ${L.toUpperCase()}`}
          >
            {LANG_INFO[L].flag} {L.toUpperCase()}
          </button>
        ))}
        {showSpeak && (
          <button
            type="button"
            className="iconbtn"
            onClick={speak}
            disabled={!shown || speaking || busy}
            title={`Speak in ${lang.toUpperCase()}`}
            style={{ marginLeft: 4 }}
          >
            {speaking ? "🔊" : "🔉"}
          </button>
        )}
      </div>
    </div>
  );
}
