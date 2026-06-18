/**
 * CaptionAI API client.
 *
 * Uses the official @gradio/client so it works against any Gradio version
 * (4.x or 5.x — the URL format changed between them and this library
 * abstracts that away).
 *
 * Set NEXT_PUBLIC_API_URL to the Space URL (e.g. https://username-captionai.hf.space)
 * or to http://localhost:7860 for local development.
 */
"use client";

import { Client } from "@gradio/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export type Dataset = "flickr8k" | "flickr30k" | "coco";
export const ALL_DATASETS: Dataset[] = ["flickr8k", "flickr30k", "coco"];

export class ApiError extends Error {
  status?: number;
  constructor(msg: string, status?: number) {
    super(msg);
    this.status = status;
  }
}

let _clientPromise: Promise<Client> | null = null;

/**
 * Lazy-initialise the Gradio client. We connect once and reuse the same
 * Client instance across all requests.
 */
async function getClient(): Promise<Client> {
  if (!API_URL) {
    throw new ApiError(
      "Backend not configured. Set NEXT_PUBLIC_API_URL in .env.local to your Hugging Face Space URL (or http://localhost:7860 for local dev)."
    );
  }
  if (!_clientPromise) {
    _clientPromise = Client.connect(API_URL).catch((e) => {
      _clientPromise = null;
      throw new ApiError(
        `Could not connect to Gradio backend at ${API_URL}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    });
  }
  return _clientPromise;
}

export type CaptionAllResponse = { m1: string; m2: string; m3: string };
export type CaptionAttentionResponse = {
  caption: string[];
  attention: number[][];
};
export type RandomImageResponse = {
  image_url: string;
  references: string[];
};

async function predict<T = any>(endpoint: string, payload: any): Promise<T> {
  const client = await getClient();
  try {
    const result: any = await client.predict(`/${endpoint}`, payload);
    return result.data as T;
  } catch (e: any) {
    throw new ApiError(
      `Gradio /${endpoint} failed: ${e?.message ?? String(e)}`
    );
  }
}

export async function caption(
  imageBlob: Blob,
  modelId: 1 | 2 | 3 = 1,
  dataset: Dataset = "coco"
): Promise<string> {
  const data = await predict<[string]>("caption", {
    image: imageBlob,
    model_id: modelId,
    dataset,
  });
  return data[0] ?? "";
}

export async function captionAll(
  imageBlob: Blob,
  dataset: Dataset = "coco"
): Promise<CaptionAllResponse> {
  const data = await predict<[string, string, string]>("caption_all", {
    image: imageBlob,
    dataset,
  });
  return { m1: data[0] ?? "", m2: data[1] ?? "", m3: data[2] ?? "" };
}

export async function captionAttention(
  imageBlob: Blob,
  dataset: Dataset = "coco"
): Promise<CaptionAttentionResponse> {
  const data = await predict<[string[], number[][]]>("caption_attention", {
    image: imageBlob,
    dataset,
  });
  return { caption: data[0] ?? [], attention: data[1] ?? [] };
}

export async function randomTestImage(
  dataset: Dataset = "coco"
): Promise<RandomImageResponse> {
  const data = await predict<[any, string[]]>("random_test_image", {
    dataset,
  });
  const raw = data[0];
  let imageUrl = "";
  if (typeof raw === "string") {
    imageUrl = raw;
  } else if (raw && typeof raw === "object") {
    imageUrl = raw.url ?? raw.path ?? raw.data ?? "";
    if (
      imageUrl &&
      !imageUrl.startsWith("http") &&
      !imageUrl.startsWith("data:")
    ) {
      imageUrl = `${API_URL.replace(/\/$/, "")}/file=${imageUrl}`;
    }
  }
  return { image_url: imageUrl, references: data[1] ?? [] };
}

/** Quick health check — returns true if the Space is awake and serving. */
export async function pingBackend(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    // The Gradio Client.connect() will throw if backend unreachable.
    await getClient();
    return true;
  } catch {
    _clientPromise = null;
    return false;
  }
}

/** Fetch a URL as a Blob (for converting the test image into something we can re-upload). */
export async function urlToBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new ApiError(`Could not fetch image at ${url}`);
  return await r.blob();
}
