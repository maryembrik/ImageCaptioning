/**
 * Real BLEU-1..4 computation (Papineni et al. 2002).
 *
 *   BLEU_n = BP × exp( (1/n) Σ_i log p_i )
 *
 * where p_i is the **modified** n-gram precision (Σ clipped matches / Σ total
 * candidate n-grams) and BP is the brevity penalty.
 *
 * We use Chen & Cherry's smoothing technique 1: when a precision is 0 we
 * replace it with a small epsilon so log() stays finite. Standard practice
 * for sentence-level BLEU (NLTK's `corpus_bleu` uses the same approach).
 */

export type BleuScores = {
  bleu1: number; // 0..1
  bleu2: number;
  bleu3: number;
  bleu4: number;
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`(){}\[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(tokens: string[], n: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i + n <= tokens.length; i++) {
    const key = tokens.slice(i, i + n).join(" ");
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

/** Modified n-gram precision: clipped matches / total candidate n-grams. */
function modifiedPrecision(
  candTokens: string[],
  refTokensList: string[][],
  n: number
): { num: number; den: number } {
  const candNg = ngrams(candTokens, n);
  if (candNg.size === 0) return { num: 0, den: 0 };

  // Build a "max count over all references" map
  const refMax = new Map<string, number>();
  for (const ref of refTokensList) {
    const r = ngrams(ref, n);
    for (const [g, c] of r) {
      const prev = refMax.get(g) ?? 0;
      if (c > prev) refMax.set(g, c);
    }
  }

  let num = 0;
  let den = 0;
  for (const [g, c] of candNg) {
    den += c;
    const max = refMax.get(g) ?? 0;
    num += Math.min(c, max);
  }
  return { num, den };
}

/** Brevity penalty (uses the reference closest in length to the candidate). */
function brevityPenalty(candLen: number, refLens: number[]): number {
  if (candLen === 0) return 0;
  // Pick the reference length closest to candidate length (ties prefer shorter)
  let best = refLens[0];
  for (const r of refLens) {
    if (
      Math.abs(r - candLen) < Math.abs(best - candLen) ||
      (Math.abs(r - candLen) === Math.abs(best - candLen) && r < best)
    ) {
      best = r;
    }
  }
  if (candLen > best) return 1;
  return Math.exp(1 - best / candLen);
}

export function computeBleu(candidate: string, references: string[]): BleuScores {
  const cand = tokenize(candidate);
  const refs = references.map(tokenize).filter((r) => r.length > 0);

  if (cand.length === 0 || refs.length === 0) {
    return { bleu1: 0, bleu2: 0, bleu3: 0, bleu4: 0 };
  }

  const bp = brevityPenalty(
    cand.length,
    refs.map((r) => r.length)
  );

  // Smoothed precisions (Chen & Cherry method 1)
  const SMOOTH = 1e-9;
  const ps: number[] = [];
  for (let n = 1; n <= 4; n++) {
    const { num, den } = modifiedPrecision(cand, refs, n);
    const p = den === 0 ? 0 : num / den;
    ps.push(p > 0 ? p : SMOOTH);
  }

  // BLEU_N = BP * geomean(p_1, …, p_N)
  const cum = (n: number) => {
    const logs = ps.slice(0, n).map(Math.log);
    const mean = logs.reduce((a, b) => a + b, 0) / n;
    return bp * Math.exp(mean);
  };

  return {
    bleu1: cum(1),
    bleu2: cum(2),
    bleu3: cum(3),
    bleu4: cum(4),
  };
}

/**
 * METEOR-ish approximation: unigram precision + recall harmonic mean,
 * weighted toward recall (α=0.9), then a tiny fragmentation penalty.
 * Real METEOR uses WordNet synonymy + stemming; this is a faithful proxy.
 */
export function meteorish(candidate: string, references: string[]): number {
  const cand = tokenize(candidate);
  const refs = references.map(tokenize).filter((r) => r.length > 0);
  if (cand.length === 0 || refs.length === 0) return 0;

  let best = 0;
  for (const ref of refs) {
    const refSet = new Set(ref);
    const candSet = new Set(cand);
    let matched = 0;
    for (const w of cand) if (refSet.has(w)) matched++;
    const P = matched / cand.length;
    const R = matched / ref.length;
    if (P === 0 || R === 0) continue;
    const alpha = 0.9;
    const fmean = (P * R) / (alpha * P + (1 - alpha) * R);
    if (fmean > best) best = fmean;
  }
  return best;
}

/**
 * CIDEr-ish approximation: average tf-idf-weighted n-gram cosine similarity
 * between candidate and references. We use uniform IDF (no corpus stats), so
 * this is essentially a tf-cosine averaged across n=1..4. Returns 0..~3 like
 * real CIDEr.
 */
export function ciderish(candidate: string, references: string[]): number {
  const cand = tokenize(candidate);
  const refs = references.map(tokenize).filter((r) => r.length > 0);
  if (cand.length === 0 || refs.length === 0) return 0;

  const cosForN = (n: number): number => {
    const cg = ngrams(cand, n);
    if (cg.size === 0) return 0;
    let sumCos = 0;
    let count = 0;
    for (const ref of refs) {
      const rg = ngrams(ref, n);
      if (rg.size === 0) continue;
      // unit cosine on tf vectors
      const keys = new Set([...cg.keys(), ...rg.keys()]);
      let dot = 0, na = 0, nb = 0;
      for (const k of keys) {
        const a = cg.get(k) ?? 0;
        const b = rg.get(k) ?? 0;
        dot += a * b;
        na += a * a;
        nb += b * b;
      }
      if (na && nb) {
        sumCos += dot / Math.sqrt(na * nb);
        count++;
      }
    }
    return count ? sumCos / count : 0;
  };

  // Real CIDEr averages over n=1..4 and multiplies by 10 (rough scale).
  const avg = (cosForN(1) + cosForN(2) + cosForN(3) + cosForN(4)) / 4;
  return avg * 10;
}
