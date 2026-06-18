/**
 * Cartoonify an image by calling a public Hugging Face Space.
 *
 * Gradio Spaces are flaky:
 *   - Some go private/gated and start returning 401
 *   - Each Space names its image parameter differently (image, img, input_image, etc.)
 *   - Gradio v5 validates parameter NAMES client-side, so passing the wrong key
 *     throws "No value provided for required parameter: <real name>" *before* a
 *     network call is even made.
 *
 * Strategy:
 *   1. Keep a curated list of currently-public Spaces (no auth needed).
 *   2. For each Space, call `view_api()` to discover the real parameter name.
 *   3. Pass the blob under that exact name. Only fall back to positional args
 *      if the API description is unavailable.
 *   4. Wrap every predict in an extra `.catch` so Gradio's side-channel
 *      rejections don't leak as "Uncaught (in promise)" in the console.
 */
"use client";

import { Client } from "@gradio/client";

export class CartoonifyError extends Error {}

/**
 * Ordered list of free **public** Spaces.
 *
 * We deliberately exclude any Space that has started gating access (returns
 * 401 on `/api/spaces/<id>/host`) — those are dead weight that pollute the
 * console with auth errors users can't fix.
 */
const SPACES: Array<{ id: string; label: string }> = [
  { id: "akhaliq/AnimeGANv2",       label: "AnimeGAN v2" },
  { id: "Manjushri/AnimeGANv3",     label: "AnimeGAN v3" },
  { id: "Damarcreative/AnimeGANv3", label: "AnimeGAN v3 (clone)" },
  { id: "AryanGupta/Photo2Cartoon", label: "Photo2Cartoon" },
];

/** Convert any Gradio image return shape into something <img src> can load. */
function normaliseImageOutput(raw: any, spaceId: string): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Blob) return URL.createObjectURL(raw);
  if (typeof raw === "object") {
    const v = raw.value ?? raw;
    const u =
      v.url ??
      v.path ??
      v.data ??
      v.name ??
      v.image ??
      (typeof v === "string" ? v : null);
    if (!u || typeof u !== "string") return null;
    if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("blob:")) {
      return u;
    }
    // Relative path inside the Space — build the file URL.
    return `https://${spaceId.replace("/", "-")}.hf.space/file=${u}`;
  }
  return null;
}

function findImageInResult(result: any, spaceId: string): string | null {
  if (!result) return null;
  const datas = Array.isArray(result.data) ? result.data : [result.data];
  for (const d of datas) {
    const u = normaliseImageOutput(d, spaceId);
    if (u) return u;
  }
  return null;
}

/** Heuristic: is this parameter the "image" input? */
function looksLikeImageParam(p: any): boolean {
  const name = String(p?.parameter_name ?? "").toLowerCase();
  const pyType = String(p?.python_type?.type ?? p?.type ?? "").toLowerCase();
  if (pyType.includes("filepath") || pyType.includes("dict")) return true;
  return (
    name === "img" ||
    name === "image" ||
    name === "input_image" ||
    name === "inp" ||
    name === "input" ||
    name.includes("image") ||
    name.includes("photo") ||
    name.includes("img")
  );
}

/** Silence Gradio's side-channel rejections so they don't show as uncaught. */
function safePredict(client: any, ep: any, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const p = client.predict(ep, args);
      // p is a thenable — attach BOTH a resolve and a catch so neither path leaks
      Promise.resolve(p).then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }).catch((e) => {
    // Re-throw as a normal error caller can handle, swallowing the original
    // unhandled-rejection path.
    throw e instanceof Error ? e : new Error(String(e));
  });
}

/**
 * Try every endpoint, using the REAL parameter names discovered via view_api().
 */
async function tryAllEndpoints(
  client: any,
  spaceId: string,
  blob: Blob
): Promise<string | null> {
  let api: any = null;
  try {
    api = await client.view_api();
  } catch {
    api = null;
  }

  type Ep = { name: string | number; params: any[] };
  const endpoints: Ep[] = [];

  if (api?.named_endpoints) {
    for (const [name, info] of Object.entries(api.named_endpoints)) {
      endpoints.push({ name, params: (info as any)?.parameters ?? [] });
    }
  }
  if (api?.unnamed_endpoints) {
    for (const [idx, info] of Object.entries(api.unnamed_endpoints)) {
      endpoints.push({ name: Number(idx), params: (info as any)?.parameters ?? [] });
    }
  }
  // Absolute last resort — most Spaces still expose /predict
  if (endpoints.length === 0) {
    endpoints.push({ name: "/predict", params: [] });
    endpoints.push({ name: 0, params: [] });
  }

  for (const { name, params } of endpoints) {
    const argShapes: any[] = [];

    if (params.length > 0) {
      // Build a named-args object with the REAL parameter name.
      const imgParam = params.find(looksLikeImageParam) ?? params[0];
      const realName = imgParam?.parameter_name;
      if (realName) {
        const obj: Record<string, any> = { [realName]: blob };
        // Fill any other required params with their default if known.
        for (const p of params) {
          if (p.parameter_name === realName) continue;
          if (p.parameter_has_default) continue; // optional → skip
          // Try a sensible default
          obj[p.parameter_name] = p.parameter_default ?? "";
        }
        argShapes.push(obj);
      }
      // Also try positional, in case named call fails
      argShapes.push([blob]);
    } else {
      // No API metadata — guess every common shape.
      argShapes.push(
        [blob],
        { img: blob },
        { image: blob },
        { input_image: blob },
        { input: blob }
      );
    }

    for (const args of argShapes) {
      try {
        const result: any = await safePredict(client, name, args);
        const url = findImageInResult(result, spaceId);
        if (url) return url;
      } catch {
        // try next shape / endpoint
      }
    }
  }
  return null;
}

/**
 * Public API: cartoonify a Blob. Returns the styled image URL + which Space served it.
 */
export async function cartoonify(
  imageBlob: Blob
): Promise<{ url: string; spaceUsed: string }> {
  const errors: string[] = [];

  for (const space of SPACES) {
    try {
      const client: any = await Client.connect(space.id);
      const url = await tryAllEndpoints(client, space.id, imageBlob);
      if (url) return { url, spaceUsed: space.label };
      errors.push(`${space.label}: no endpoint accepted the image`);
    } catch (e: any) {
      errors.push(`${space.label}: ${e?.message ?? String(e)}`);
    }
  }

  throw new CartoonifyError(
    "All cartoonify Spaces failed.\n" + errors.join("\n")
  );
}
