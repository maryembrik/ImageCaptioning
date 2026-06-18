/**
 * Free translation using MyMemory's public API (no key, ~5K chars/day per IP).
 * https://mymemory.translated.net/doc/spec.php
 */
export async function translate(
  text: string,
  from: string,
  to: string
): Promise<string> {
  if (!text.trim()) return "";
  const url =
    "https://api.mymemory.translated.net/get?" +
    new URLSearchParams({ q: text, langpair: `${from}|${to}` });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Translation API returned ${r.status}`);
  const json = await r.json();
  return json?.responseData?.translatedText ?? text;
}
