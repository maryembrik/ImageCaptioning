"use client";

import { useEffect, useState } from "react";
import { useToast } from "./Toast";
import ImageUploader, { ImagePreview } from "./ImageUploader";
import CaptionDisplay from "./CaptionDisplay";
import {
  caption as apiCaption,
  ApiError,
  urlToBlob,
  Dataset,
} from "@/lib/api";
import { cartoonify, CartoonifyError } from "@/lib/cartoonify";
import { cartoonifyLocal } from "@/lib/cartoon_local";

export default function Cartoonify({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState("");
  const [cartoonUrl, setCartoonUrl] = useState("");
  const [spaceUsed, setSpaceUsed] = useState("");
  const [originalCap, setOriginalCap] = useState("");
  const [cartoonCap, setCartoonCap] = useState("");
  const [phase, setPhase] = useState<"idle" | "cartoonify" | "caption" | "done">(
    "idle"
  );

  // Silence stray "Uncaught (in promise)" noise from the Gradio client when a
  // Space's parameter name doesn't match what we tried. These are already
  // caught downstream by safePredict, but the side-channel can still fire.
  useEffect(() => {
    const handler = (ev: PromiseRejectionEvent) => {
      const msg = String(ev.reason?.message ?? ev.reason ?? "");
      if (
        msg.includes("No value provided for required parameter") ||
        msg.includes("There is no endpoint matching")
      ) {
        ev.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  const onImage = async (b: Blob, url: string) => {
    setSrc(url);
    setCartoonUrl("");
    setSpaceUsed("");
    setOriginalCap("");
    setCartoonCap("");
    setPhase("cartoonify");

    // Caption the original in parallel with cartoonifying — saves time
    const originalP = apiCaption(b, 1, dataset).catch((e) => {
      console.error("Original caption failed", e);
      return "";
    });

    try {
      const { url: cUrl, spaceUsed: lbl } = await cartoonify(b);
      setCartoonUrl(cUrl);
      setSpaceUsed(lbl);
      setPhase("caption");

      const original = await originalP;
      setOriginalCap(original);

      // Now caption the cartoonified image too — fetch the URL back as a blob
      try {
        const cartoonBlob = await urlToBlob(cUrl);
        const cCap = await apiCaption(cartoonBlob, 1, dataset);
        setCartoonCap(cCap);
      } catch (e: any) {
        console.error("Cartoon caption failed", e);
        setCartoonCap(""); // graceful: leave empty
      }
      setPhase("done");
    } catch (e: any) {
      console.warn("Remote cartoonify failed, falling back to local canvas filter.", e);
      try {
        const localUrl = await cartoonifyLocal(b);
        setCartoonUrl(localUrl);
        setSpaceUsed("local canvas filter (offline)");
        setPhase("caption");

        const original = await originalP;
        setOriginalCap(original);

        // Caption the locally-stylised image too
        try {
          const cBlob = await urlToBlob(localUrl);
          const cCap = await apiCaption(cBlob, 1, dataset);
          setCartoonCap(cCap);
        } catch {
          setCartoonCap("");
        }
        setPhase("done");
        push("ok", "Cartoonify Spaces are sleeping — used local filter instead. Try again in a minute for a full GAN result.");
      } catch (localErr: any) {
        setPhase("idle");
        if (e instanceof ApiError) push("err", e.message);
        else push("err", "Cartoonify failed: " + (e?.message ?? e));
      }
    }
  };

  const clear = () => {
    setSrc("");
    setCartoonUrl("");
    setSpaceUsed("");
    setOriginalCap("");
    setCartoonCap("");
    setPhase("idle");
  };

  return (
    <div>
      {src ? (
        <div className="cartoon-grid">
          {/* Left: original */}
          <div>
            <div className="cap-label" style={{ marginBottom: 8 }}>
              <span>📷 original photo</span>
            </div>
            <ImagePreview src={src} onClear={clear} />
            <div style={{ marginTop: 12 }}>
              <div className="cap-label" style={{ marginBottom: 6 }}>
                <span>🤖 caption · M1 · {dataset}</span>
              </div>
              {originalCap ? (
                <CaptionDisplay text={originalCap} compact />
              ) : (
                <div style={{ marginTop: 4 }}>
                  <span className="skel w90"></span>
                  <span className="skel w70"></span>
                </div>
              )}
            </div>
          </div>

          {/* Right: cartoon */}
          <div>
            <div className="cap-label" style={{ marginBottom: 8 }}>
              <span>🎨 cartoonified</span>
              {spaceUsed && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    color: "var(--text-3)",
                  }}
                >
                  via {spaceUsed}
                </span>
              )}
            </div>
            {cartoonUrl ? (
              <div className="plate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cartoonUrl} alt="cartoon version" />
                <div className="plate-toolbar">
                  <span className="chip">cartoon · style transfer</span>
                  <a
                    className="iconbtn"
                    href={cartoonUrl}
                    download="cartoon.png"
                    title="Download"
                  >
                    ↓
                  </a>
                </div>
              </div>
            ) : (
              <div
                className="plate"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: "var(--text-3)",
                }}
              >
                {phase === "cartoonify"
                  ? "✨ Cartoonifying… (~3–8 sec)"
                  : "—"}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className="cap-label" style={{ marginBottom: 6 }}>
                <span>🤖 caption · M1 · cartoon version</span>
              </div>
              {cartoonCap ? (
                <CaptionDisplay text={cartoonCap} compact />
              ) : phase === "done" ? (
                <div className="cap-text" style={{ color: "var(--text-3)" }}>
                  Couldn&apos;t caption the cartoon. (model may struggle with
                  stylized art — that&apos;s a finding!)
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <span className="skel w90"></span>
                  <span className="skel w70"></span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <ImageUploader
            onImage={onImage}
            hint="any photo — we'll cartoonify it AND caption both versions"
          />
        </div>
      )}

      <p
        style={{
          color: "var(--text-2)",
          fontSize: 13.5,
          marginTop: 18,
          lineHeight: 1.6,
          maxWidth: 760,
        }}
      >
        We send your photo to a free Hugging Face Space running a White-box
        cartoonization or AnimeGAN model, then run <b>our own M1 captioner on
        both versions</b>. This shows how our model handles a domain shift —
        photo → cartoon — and is a genuinely interesting research angle.
      </p>
    </div>
  );
}
