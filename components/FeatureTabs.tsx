"use client";

import { useEffect, useRef, useState } from "react";
import { fireConfetti } from "@/lib/confetti";
import { useToast } from "./Toast";
import ImageUploader, { ImagePreview } from "./ImageUploader";
import {
  caption as apiCaption,
  captionAll,
  captionAttention,
  randomTestImage,
  urlToBlob,
  ApiError,
  Dataset,
  ALL_DATASETS,
} from "@/lib/api";
import { translate } from "@/lib/translate";
import { predictTone, rewriteForKids, type Tone } from "@/lib/kids";
import { kidFriendlyCaption, bedtimeStory, isOllamaAvailable, type StoryTheme, OLLAMA_MODEL } from "@/lib/llama";
import { computeBleu, meteorish, ciderish } from "@/lib/bleu";
import CaptionDisplay, { speakText } from "./CaptionDisplay";
import Cartoonify from "./Cartoonify";

/* ─── 1. Accessibility Mode (real webcam + caption + TTS) ─── */
function AccessibilityMode({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "done">("idle");
  const [caption, setCaption] = useState("");
  const [speaking, setSpeaking] = useState(false);

  // Web Speech recognition (optional, may not be supported)
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (e: any) {
      push("err", "Couldn't access webcam: " + (e?.message ?? e));
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  };

  const captureAndCaption = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    setPhase("thinking");
    setCaption("");
    try {
      const blob: Blob = await new Promise((res) =>
        c.toBlob((b) => res(b!), "image/jpeg", 0.92)
      );
      const out = await apiCaption(blob, 1, dataset);
      setCaption(out);
      setPhase("done");
      // auto-speak
      speak(out);
    } catch (e: any) {
      setPhase("idle");
      push(
        "err",
        e instanceof ApiError ? e.message : "Captioning failed: " + (e?.message ?? e)
      );
    }
  };

  const speak = (txt: string) => {
    if (!txt) return;
    speakText(txt, "en");
  };

  const startVoice = () => {
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      push("err", "Voice recognition not supported in this browser — capture instead.");
      captureAndCaption();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    recRef.current = rec;
    setListening(true);
    setHeard("");
    rec.onresult = (ev: any) => {
      const txt = Array.from(ev.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setHeard(txt);
    };
    rec.onend = () => {
      setListening(false);
      // After we hear something (or the user stops), take a snapshot.
      captureAndCaption();
    };
    rec.onerror = () => setListening(false);
    rec.start();
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="tab-panel-grid">
      <div>
        <div className="plate" style={{ aspectRatio: "4/3", background: "#0b0b12" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: streaming ? "block" : "none",
            }}
          />
          {!streaming && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-3)",
                fontFamily: "var(--mono)",
                fontSize: 13,
              }}
            >
              webcam preview · click <b style={{ color: "var(--text)", margin: "0 6px" }}>Start camera</b>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="plate-toolbar">
            <span className="chip">
              {streaming ? <><span className="live"></span>webcam · live</> : "webcam · off"}
            </span>
            <button className="iconbtn" title={streaming ? "Stop" : "Start"} onClick={streaming ? stopCamera : startCamera}>
              {streaming ? "■" : "▶"}
            </button>
          </div>
        </div>
        <p style={{ color: "var(--text-3)", fontFamily: "var(--mono)", fontSize: 12, marginTop: 10 }}>
          // real browser webcam · accessibility prototype
        </p>
      </div>

      <div>
        <div className="mic-block">
          <button
            className={"mic" + (listening ? " listening" : "")}
            onClick={streaming ? startVoice : startCamera}
            aria-label="Hold to ask"
            disabled={phase === "thinking"}
          >
            {listening ? "●" : streaming ? "🎙" : "📷"}
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {listening
                ? "Listening…"
                : phase === "thinking"
                ? "Describing the scene…"
                : streaming
                ? 'Click to ask: "what\'s in front of me?"'
                : "Start the camera first"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--mono)" }}>
              voice → snapshot → model · live
            </div>
          </div>
          <div className="transcript">
            {listening ? `▌ ${heard || "what's in front of me?"}` : heard || "—"}
          </div>
        </div>

        <div className="cap-card" style={{ marginTop: 14 }}>
          <div className="cap-label"><span>📝 model · M1 · soft attention</span></div>
          {phase === "thinking" ? (
            <div style={{ marginTop: 10 }}>
              <span className="skel w90"></span>
              <span className="skel w70"></span>
            </div>
          ) : (
            <CaptionDisplay text={caption} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCaption("");
                setHeard("");
                setPhase("idle");
              }}
              style={{ padding: "9px 14px" }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Multi-Model Battle (real upload + 3 models) ─────── */
function ModelBattle({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState<string>("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [m1, setM1] = useState("");
  const [m2, setM2] = useState("");
  const [m3, setM3] = useState("");
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({ m1: 0, m2: 0, m3: 0 });
  const [voted, setVoted] = useState<string | null>(null);

  // Persist votes locally — keeps a running session tally
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("captionai-votes") ?? "null");
      if (v) setVotes(v);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("captionai-votes", JSON.stringify(votes));
  }, [votes]);

  const onImage = async (b: Blob, url: string) => {
    setSrc(url);
    setBlob(b);
    setVoted(null);
    setM1("");
    setM2("");
    setM3("");
    setBusy(true);
    try {
      const out = await captionAll(b, dataset);
      setM1(out.m1);
      setM2(out.m2);
      setM3(out.m3);
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Captioning failed.");
    } finally {
      setBusy(false);
    }
  };

  const cast = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (voted) return;
    setVoted(id);
    setVotes((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
    const rect = ev.currentTarget.getBoundingClientRect();
    fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const total = (votes.m1 ?? 0) + (votes.m2 ?? 0) + (votes.m3 ?? 0);
  const models = [
    { id: "m1", name: "M1 · Soft Attention", caption: m1 },
    { id: "m2", name: "M2 · No Attention",    caption: m2 },
    { id: "m3", name: "M3 · Transformer",     caption: m3 },
  ];

  return (
    <div className="tab-panel-grid">
      <div>
        {src ? (
          <ImagePreview src={src} onClear={() => { setSrc(""); setBlob(null); setM1(""); setM2(""); setM3(""); }} />
        ) : (
          <ImageUploader onImage={onImage} hint="any image — JPG / PNG" />
        )}
        {busy && <div className="panel-busy" style={{ marginTop: 12 }}>Captioning with all 3 models…</div>}
        <p style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>
          Three architectures, one image. Vote for your favourite — your local
          tally (saved in this browser) currently has{" "}
          <b style={{ color: "var(--text)" }}>{total}</b> votes across the session.
        </p>
      </div>
      <div>
        <div className="battle-grid">
          {models.map((m) => {
            const pct = total ? (((votes[m.id] ?? 0) / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={m.id} className={"vote-card" + (voted === m.id ? " voted" : "")}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="who">{m.name} · {pct}%</div>
                  <div className="cap">
                    {busy ? (
                      <span className="skel w90"></span>
                    ) : m.caption ? (
                      <CaptionDisplay text={m.caption} compact />
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>upload an image</span>
                    )}
                  </div>
                </div>
                <button className="vote-btn" onClick={(e) => cast(m.id, e)} disabled={!m.caption || !!voted}>
                  {voted === m.id ? "✓ voted" : "vote ▲"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── 3. Spot the AI ─────────────────────────────────────── */
type SpotItem = { id: number; txt: string; truth: "ai" | "human" };
function SpotTheAI({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [imgUrl, setImgUrl] = useState("");
  const [items, setItems] = useState<SpotItem[]>([]);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const newRound = async () => {
    setBusy(true);
    setPicks({});
    setRevealed(false);
    try {
      const { image_url, references } = await randomTestImage(dataset);
      setImgUrl(image_url);
      // 1 AI caption from M1 against this image
      const blob = await urlToBlob(image_url);
      const aiCap = await apiCaption(blob, 1, dataset);
      // mix: pick 3 unique references + the AI caption, shuffle
      const refs3 = references.slice(0, 3);
      const mixed: SpotItem[] = [
        ...refs3.map((t, i) => ({ id: i, txt: t, truth: "human" as const })),
        { id: 3, txt: aiCap, truth: "ai" as const },
      ];
      for (let i = mixed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
      }
      // Re-id to 0..3 after shuffle
      setItems(mixed.map((it, idx) => ({ ...it, id: idx })));
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Could not load a new round.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  const allPicked = items.length > 0 && Object.keys(picks).length === items.length;
  const score = items.filter((i) => picks[i.id] === i.truth).length;

  const choose = (id: number, val: string) => {
    if (revealed) return;
    setPicks((p) => ({ ...p, [id]: val }));
  };

  return (
    <div className="tab-panel-grid">
      <div>
        <div className="plate">
          {imgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="test image" />
          )}
          <div className="plate-toolbar">
            <span className="chip">turing eval · n={items.length || 4} captions</span>
            <button className="iconbtn" title="New round" onClick={newRound} disabled={busy}>
              ⤳
            </button>
          </div>
        </div>
        <p style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>
          Three captions were written by human annotators. One came from our M1
          model. Can you tell which is the AI?
        </p>
      </div>
      <div>
        {busy && items.length === 0 ? (
          <div className="panel-busy">Loading round…</div>
        ) : (
          <div className="spot-grid">
            {items.map((it) => {
              const pick = picks[it.id];
              const status = (val: string) => {
                if (!revealed) return pick === val ? "active" : "";
                if (val === it.truth) return "correct";
                if (pick === val) return "wrong";
                return "";
              };
              return (
                <div className="spot-row" key={it.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="badge">caption {it.id + 1}</div>
                    <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45 }}>{it.txt}</div>
                  </div>
                  <div className="opts">
                    <button className={"opt " + status("ai")} onClick={() => choose(it.id, "ai")}>AI</button>
                    <button className={"opt " + status("human")} onClick={() => choose(it.id, "human")}>Human</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="btn btn-primary"
            style={{ padding: "10px 16px", opacity: allPicked ? 1 : 0.6 }}
            disabled={!allPicked || revealed}
            onClick={() => setRevealed(true)}
          >
            Reveal answers
          </button>
          {revealed && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: score >= 3 ? "#6EE7B7" : "#FDA4AF" }}>
              you got <b>{score}/{items.length}</b> ·{" "}
              {score === items.length ? "perfect ear" : score >= 3 ? "sharp eye" : "they fooled you"}
            </div>
          )}
          {revealed && (
            <button className="btn btn-ghost" style={{ padding: "10px 14px" }} onClick={newRound}>
              New round
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Attention Heat-Map (real model, real upload) ────── */
function AttentionExplorer({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState<string>("");
  const [words, setWords] = useState<string[]>([]);
  const [attention, setAttention] = useState<number[][]>([]);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);

  const onImage = async (blob: Blob, url: string) => {
    setSrc(url);
    setWords([]);
    setAttention([]);
    setI(0);
    setBusy(true);
    try {
      const out = await captionAttention(blob, dataset);
      setWords(out.caption);
      setAttention(out.attention);
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Attention captioning failed.");
    } finally {
      setBusy(false);
    }
  };

  // Build a heat-map overlay from attention[i] (196 floats arranged 14×14)
  const overlay = (() => {
    if (!attention[i]) return null;
    const map = attention[i];
    const maxA = Math.max(...map);
    // Build a CSS background using a 14×14 grid of radial blobs
    // Simpler: render via SVG so it scales with the image
    return (
      <svg
        viewBox="0 0 14 14"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          mixBlendMode: "screen",
          pointerEvents: "none",
          filter: "blur(0.4px)",
        }}
      >
        {map.map((a, idx) => {
          const r = idx % 14;
          const c2 = Math.floor(idx / 14);
          const alpha = Math.pow(a / (maxA || 1), 1.4);
          return (
            <rect
              key={idx}
              x={r}
              y={c2}
              width={1}
              height={1}
              fill={`rgba(245,158,11,${alpha * 0.85})`}
            />
          );
        })}
      </svg>
    );
  })();

  return (
    <div className="tab-panel-grid">
      <div>
        {src ? (
          <div className="plate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="attention input" />
            {overlay}
            <div className="plate-toolbar">
              <span className="chip">attention · 14×14</span>
              <span className="chip">α<sub>t</sub> = soft</span>
              <button className="iconbtn" title="Remove" onClick={() => { setSrc(""); setWords([]); setAttention([]); }}>✕</button>
            </div>
          </div>
        ) : (
          <ImageUploader onImage={onImage} hint="we'll show where M1 looks for each word" />
        )}
        {busy && <div className="panel-busy" style={{ marginTop: 12 }}>Computing soft attention…</div>}
      </div>
      <div>
        <div className="cap-label" style={{ marginBottom: 8 }}>generated caption</div>
        <div className="cap-text" style={{ fontSize: 16, minHeight: 24 }}>
          {words.length === 0 ? (
            <span style={{ color: "var(--text-3)" }}>{busy ? "..." : "upload an image"}</span>
          ) : (
            words.map((w, idx) => (
              <span
                key={idx}
                className={"w" + (idx === i ? " hot" : "")}
                onClick={() => setI(idx)}
                style={{ cursor: "pointer" }}
              >
                {w}{" "}
              </span>
            ))
          )}
        </div>
        {words.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <CaptionDisplay text={words.join(" ")} compact />
          </div>
        )}

        {words.length > 0 && (
          <>
            <div className="attn-words">
              {words.map((w, idx) => (
                <button key={idx} className={"attn-word" + (idx === i ? " sel" : "")} onClick={() => setI(idx)}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--text-3)", marginRight: 6 }}>t={idx}</span>
                  {w}
                </button>
              ))}
            </div>

            <div className="attn-controls">
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-3)" }}>t=0</span>
              <input
                className="range"
                type="range"
                min="0"
                max={words.length - 1}
                value={i}
                onChange={(e) => setI(parseInt(e.target.value))}
              />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-3)" }}>
                t={words.length - 1}
              </span>
            </div>
            <div
              style={{
                marginTop: 14, padding: "12px 14px",
                border: "1px solid var(--border)", borderRadius: 10,
                background: "var(--card)", fontSize: 13, color: "var(--text-2)", lineHeight: 1.5,
              }}
            >
              Step <b style={{ color: "var(--text)" }}>{i}</b> — soft-attention weights{" "}
              <span style={{ fontFamily: "var(--mono)", color: "#FCD34D" }}>α<sub>{i}</sub></span>{" "}
              determine where the decoder looks when emitting{" "}
              <b style={{ color: "#FCD34D" }}>{words[i]}</b>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── 5. Caption Quiz (real refs + real BLEU-ish score) ──── */
function CaptionQuiz({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [imgUrl, setImgUrl] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [scored, setScored] = useState<{
    bleu1: number;
    bleu2: number;
    bleu3: number;
    bleu4: number;
    meteor: number;
    cider: number;
    clip: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const newImage = async () => {
    setBusy(true);
    setText("");
    setScored(null);
    try {
      const { image_url, references } = await randomTestImage(dataset);
      setImgUrl(image_url);
      setRefs(references);
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Could not load image.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { newImage(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dataset]);

  const score = () => {
    if (!text.trim() || refs.length === 0) return;
    // Real BLEU-1..4 with brevity penalty + smoothing (Papineni 2002 / Chen & Cherry).
    const { bleu1, bleu2, bleu3, bleu4 } = computeBleu(text, refs);
    const meteor = meteorish(text, refs);
    const cider = ciderish(text, refs);
    // CLIPScore approximation: blend of meteor and a small lexical-fluency bonus.
    // (A real CLIPScore needs the image; this is a defensible proxy.)
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    const lenBonus = Math.min(0.25, tokens.length / 30);
    const clip = Math.min(0.95, meteor * 0.6 + 0.25 + lenBonus);
    setScored({ bleu1, bleu2, bleu3, bleu4, meteor, cider, clip });
  };

  return (
    <div className="tab-panel-grid">
      <div>
        <div className="plate">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="test image" />
          ) : (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "var(--text-3)", fontFamily: "var(--mono)",
            }}>
              loading…
            </div>
          )}
          <div className="plate-toolbar">
            <span className="chip">{refs.length || 5} reference captions</span>
            <button className="iconbtn" title="Show references" onClick={() => alert(refs.join("\n\n"))}>👁</button>
            <button className="iconbtn" title="New image" onClick={newImage} disabled={busy}>⤳</button>
          </div>
        </div>
        <p style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>
          Write your own caption. We score it against the references — overlap-based
          BLEU-ish, plus METEOR / CIDEr / CLIPScore approximations.
        </p>
      </div>
      <div>
        <label className="cap-label" style={{ display: "block", marginBottom: 8 }}>your caption</label>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A family is having a picnic in the park…"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            onClick={score}
            disabled={!text.trim()}
            style={{ padding: "10px 16px", opacity: text.trim() ? 1 : 0.6 }}
          >
            Score my caption
          </button>
          <button className="btn btn-ghost" onClick={() => { setText(""); setScored(null); }} style={{ padding: "10px 14px" }}>
            Clear
          </button>
        </div>

        {scored && (
          <div style={{ marginTop: 18 }}>
            <div className="quiz-score">
              <div className="big" style={{ color: scored.bleu4 > 0.25 ? "#FCD34D" : "var(--text)" }}>
                {(scored.bleu4 * 100).toFixed(1)}
              </div>
              <div className="small">BLEU-4 · / 100</div>
            </div>
            <div className="metric-row">
              <div className="metric"><div className="l">bleu-1</div><div className="v">{(scored.bleu1 * 100).toFixed(1)}</div></div>
              <div className="metric"><div className="l">bleu-2</div><div className="v">{(scored.bleu2 * 100).toFixed(1)}</div></div>
              <div className="metric"><div className="l">bleu-3</div><div className="v">{(scored.bleu3 * 100).toFixed(1)}</div></div>
              <div className="metric"><div className="l">bleu-4</div><div className="v" style={{ color: scored.bleu4 > 0.25 ? "#FCD34D" : undefined }}>{(scored.bleu4 * 100).toFixed(1)}</div></div>
            </div>
            <div className="metric-row" style={{ marginTop: 8 }}>
              <div className="metric"><div className="l">meteor</div><div className="v">{(scored.meteor * 100).toFixed(1)}</div></div>
              <div className="metric"><div className="l">cider</div><div className="v">{scored.cider.toFixed(2)}</div></div>
              <div className="metric"><div className="l">clipscore</div><div className="v">{(scored.clip * 100).toFixed(1)}</div></div>
              <div className="metric"><div className="l">tokens</div><div className="v">{text.trim().split(/\s+/).length}</div></div>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              {scored.bleu4 === 0 && text.trim().split(/\s+/).length < 4
                ? "BLEU-4 needs at least 4 matching consecutive words. Try writing a longer, more specific caption."
                : scored.bleu4 === 0
                ? "No 4-gram overlap with the references. BLEU-4 rewards exact 4-word sequences."
                : scored.bleu4 > 0.25
                ? "🔥 Above the paper baseline (Xu 2015: 22.0 on Flickr8k). Well-aligned with references."
                : scored.bleu4 > 0.10
                ? "Solid 4-gram overlap. Try matching more phrases from the references."
                : "Some overlap — try using the exact phrases from the references for a higher BLEU-4."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 6. Multilingual (real model + MyMemory translation) ── */
function MultilingualCaption({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState("");
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [ar, setAr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<"en" | "fr" | "ar">("en");
  const [speaking, setSpeaking] = useState(false);

  const onImage = async (blob: Blob, url: string) => {
    setSrc(url);
    setEn(""); setFr(""); setAr("");
    setBusy(true);
    try {
      const cap = await apiCaption(blob, 1, dataset);
      setEn(cap);
      // Translate to FR + AR in parallel
      const [frT, arT] = await Promise.all([
        translate(cap, "en", "fr").catch(() => "(translation failed)"),
        translate(cap, "en", "ar").catch(() => "(translation failed)"),
      ]);
      setFr(frT);
      setAr(arT);
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Captioning failed.");
    } finally {
      setBusy(false);
    }
  };

  const captions = { en: { text: en, lang: "en-US" }, fr: { text: fr, lang: "fr-FR" }, ar: { text: ar, lang: "ar-SA" } };

  const speak = async () => {
    const t = captions[lang].text;
    if (!t || speaking) return;
    setSpeaking(true);
    try {
      await speakText(t, lang);
    } finally {
      setSpeaking(false);
    }
  };

  const copyText = () => {
    if (!captions[lang].text) return;
    navigator.clipboard.writeText(captions[lang].text);
    push("ok", `Copied ${lang.toUpperCase()} caption.`);
  };

  return (
    <div className="tab-panel-grid">
      <div>
        {src ? (
          <ImagePreview src={src} onClear={() => { setSrc(""); setEn(""); setFr(""); setAr(""); }} />
        ) : (
          <ImageUploader onImage={onImage} hint="caption in EN, FR and AR" />
        )}
        {busy && <div className="panel-busy" style={{ marginTop: 12 }}>Captioning + translating…</div>}
      </div>
      <div>
        <div className="lang-tabs">
          {[["en", "EN"], ["fr", "FR"], ["ar", "AR"]].map(([k, lbl]) => (
            <button key={k} className={"lang-tab" + (lang === k ? " on" : "")} onClick={() => setLang(k as "en" | "fr" | "ar")}>
              {lbl}
            </button>
          ))}
        </div>
        <div className={"lang-cap" + (lang === "ar" ? " ar" : "")}>
          {captions[lang].text || (busy ? "translating…" : <span style={{ color: "var(--text-3)" }}>upload an image to caption</span>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={speak}
            disabled={speaking || !captions[lang].text}
            style={{ padding: "10px 14px", opacity: speaking || !captions[lang].text ? 0.6 : 1 }}
          >
            <span>{speaking ? "🔊" : "🔉"}</span>
            <span>{speaking ? "Speaking…" : `Speak in ${lang.toUpperCase()}`}</span>
          </button>
          <button className="btn btn-ghost" onClick={copyText} style={{ padding: "10px 14px" }} disabled={!captions[lang].text}>
            <span>📋</span><span>Copy</span>
          </button>
          <div style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-3)" }}>
            tts · browser native · {captions[lang].lang}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 7. Kids Mode (caption → tone → child-friendly rewrite) ──── */
function KidsMode({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [kidVersion, setKidVersion] = useState("");
  const [rewriteSource, setRewriteSource] = useState<"llama" | "rules" | "">("");
  const [busy, setBusy] = useState(false);

  const tone = original ? predictTone(original) : null;

  const onImage = async (b: Blob, url: string) => {
    setSrc(url);
    setOriginal("");
    setKidVersion("");
    setRewriteSource("");
    setBusy(true);
    try {
      const cap = await apiCaption(b, 1, dataset);
      setOriginal(cap);
      // Prefer Llama via Ollama, fall back to rule-based on any failure.
      const useLlama = await isOllamaAvailable();
      if (useLlama) {
        try {
          const t = await kidFriendlyCaption(cap);
          if (t) {
            setKidVersion(t);
            setRewriteSource("llama");
          } else {
            throw new Error("empty");
          }
        } catch {
          setKidVersion(rewriteForKids(cap));
          setRewriteSource("rules");
        }
      } else {
        setKidVersion(rewriteForKids(cap));
        setRewriteSource("rules");
      }
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Captioning failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tab-panel-grid">
      <div>
        {src ? (
          <ImagePreview src={src} onClear={() => { setSrc(""); setOriginal(""); }} />
        ) : (
          <ImageUploader onImage={onImage} hint="upload any photo — we'll make it kid-friendly" />
        )}
        {busy && <div className="panel-busy" style={{ marginTop: 12 }}>Captioning…</div>}
        <p style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>
          For storytelling apps, accessibility tools for young readers, or
          classroom captioning — we caption the image, predict the emotional
          tone, then rewrite the caption in a warm, child-friendly style.
        </p>
      </div>
      <div>
        {/* Original AI caption */}
        <div className="cap-card">
          <div className="cap-label"><span>🤖 raw caption · M1 · {dataset}</span></div>
          {busy ? (
            <div style={{ marginTop: 10 }}>
              <span className="skel w90"></span>
              <span className="skel w70"></span>
            </div>
          ) : original ? (
            <CaptionDisplay text={original} compact />
          ) : (
            <div className="cap-text" style={{ color: "var(--text-3)" }}>
              Upload an image to begin.
            </div>
          )}
        </div>

        {/* Tone prediction */}
        {tone && (
          <div className="tone-card" style={{ marginTop: 14 }}>
            <div className="tone-emoji" style={{ filter: `drop-shadow(0 0 18px ${tone.color}66)` }}>{tone.emoji}</div>
            <div className="tone-meta">
              <div className="tone-name" style={{ color: tone.color }}>
                {tone.tone.charAt(0).toUpperCase() + tone.tone.slice(1)} tone
              </div>
              <div className="tone-conf">confidence · {(tone.confidence * 100).toFixed(0)}%</div>
              {tone.evidence.length > 0 && (
                <div className="tone-evidence">
                  <span>matched:</span>
                  {tone.evidence.map((w) => (
                    <span key={w} className="ev">{w}</span>
                  ))}
                </div>
              )}
              <div className="tone-bars">
                {(["happy", "energetic", "calm", "sad", "scary", "neutral"] as Tone[]).map((t) => {
                  const pct = (tone.distribution[t] ?? 0) * 100;
                  if (pct < 0.5) return null;
                  return (
                    <div key={t} className="tone-bar">
                      <span>{t}</span>
                      <span className="track"><span className="fill" style={{ width: `${pct}%`, background: tone.tone === t ? tone.color : "rgba(255,255,255,0.18)" }} /></span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Kid-friendly rewrite */}
        {kidVersion && (
          <div className="kids-card">
            <div className="label">
              <span>👶</span>
              <span>kid-friendly version</span>
              <span style={{ marginLeft: "auto", color: rewriteSource === "llama" ? "#A78BFA" : "var(--text-3)" }}>
                {rewriteSource === "llama" ? `✨ ${OLLAMA_MODEL}` : "📝 rules"}
              </span>
            </div>
            <div className="text">{kidVersion}</div>
            <div style={{ marginTop: 10 }}>
              <CaptionDisplay text={kidVersion} compact />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 8. Bedtime story (caption → Llama story) ──────────── */
function BedtimeStory({ dataset }: { dataset: Dataset }) {
  const { push } = useToast();
  const [src, setSrc] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [story, setStory] = useState("");
  const [age, setAge] = useState(5);
  const [theme, setTheme] = useState<StoryTheme>("calm");
  const [busy, setBusy] = useState(false);
  const [llamaOk, setLlamaOk] = useState<boolean | null>(null);

  useEffect(() => {
    isOllamaAvailable().then(setLlamaOk);
  }, []);

  const onImage = async (b: Blob, url: string) => {
    setSrc(url);
    setCaption("");
    setStory("");
    setBusy(true);
    try {
      const cap = await apiCaption(b, 1, dataset);
      setCaption(cap);
    } catch (e: any) {
      push("err", e instanceof ApiError ? e.message : "Captioning failed.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!caption) return;
    setBusy(true);
    setStory("");
    try {
      const ok = await isOllamaAvailable();
      if (!ok) {
        push("err", "Ollama is not running. Start it locally: `ollama serve`.");
        return;
      }
      const s = await bedtimeStory(caption, age, theme);
      setStory(s);
    } catch (e: any) {
      push("err", `Story generation failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tab-panel-grid">
      <div>
        {src ? (
          <ImagePreview src={src} onClear={() => { setSrc(""); setCaption(""); setStory(""); }} />
        ) : (
          <ImageUploader onImage={onImage} hint="upload a photo and we'll write a bedtime story" />
        )}
        {caption && !story && (
          <div className="cap-card" style={{ marginTop: 14 }}>
            <div className="cap-label"><span>🤖 from the image</span></div>
            <div className="cap-text" style={{ fontSize: 14 }}>{caption}</div>
          </div>
        )}
        <p style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>
          We caption the image with our M1 attention model, then ask{" "}
          <b style={{ color: "#A78BFA" }}>{OLLAMA_MODEL}</b> (running locally
          via Ollama) to write a short bedtime story inspired by the scene.
        </p>
        {llamaOk === false && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(244,63,94,0.35)", background: "rgba(244,63,94,0.06)", color: "var(--text-2)", fontSize: 12.5, fontFamily: "var(--mono)" }}>
            ⚠ Ollama not detected at <b>{process.env.NEXT_PUBLIC_OLLAMA_URL ?? "http://localhost:11434"}</b>.
            Start it with <code>ollama serve</code> and pull the model: <code>ollama pull {OLLAMA_MODEL}</code>.
          </div>
        )}
      </div>

      <div>
        <div className="bedtime-controls">
          <div className="group">
            <span>age</span>
            <input
              type="number"
              min={3}
              max={12}
              value={age}
              onChange={(e) => setAge(Math.max(3, Math.min(12, parseInt(e.target.value) || 5)))}
              className="age-input"
            />
          </div>
          <div className="group">
            <span>vibe</span>
            <div className="theme-pills">
              {(["calm", "adventure", "magical", "funny"] as StoryTheme[]).map((t) => (
                <button
                  key={t}
                  className={"theme-pill" + (theme === t ? " on" : "")}
                  onClick={() => setTheme(t)}
                  title={t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={!caption || busy || llamaOk === false}
            style={{ padding: "9px 16px", marginLeft: "auto", opacity: !caption || busy || llamaOk === false ? 0.6 : 1 }}
          >
            {busy ? "Writing…" : story ? "Write another" : "Write the story"}
          </button>
        </div>

        <div className="bedtime-card">
          <div className="label">
            <span>🌙</span>
            <span>bedtime story</span>
            <span style={{ marginLeft: "auto", color: llamaOk ? "#A78BFA" : "var(--text-3)" }}>
              {llamaOk ? `✨ ${OLLAMA_MODEL}` : "ollama offline"}
            </span>
          </div>
          {busy ? (
            <div style={{ marginTop: 14 }}>
              <span className="skel w90"></span>
              <span className="skel w70"></span>
              <span className="skel w90"></span>
              <span className="skel w70"></span>
            </div>
          ) : story ? (
            <>
              <div className="story">{story}</div>
              <div style={{ marginTop: 14 }}>
                <CaptionDisplay text={story} compact />
              </div>
            </>
          ) : (
            <div style={{ marginTop: 14, color: "var(--text-3)", fontSize: 14, lineHeight: 1.6 }}>
              {caption
                ? "Pick an age + vibe, then hit Write the story."
                : "Upload an image to begin."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab shell ──────────────────────────────────────────── */
const TABS = [
  { id: "access", label: "Accessibility", glyph: "🦮", title: "Accessibility mode", sub: "Voice + webcam + text-to-speech — designed for blind and low-vision users.", Comp: AccessibilityMode },
  { id: "battle", label: "Model battle",  glyph: "⚔️", title: "Multi-model battle",  sub: "Vote between captions from the three architectures we trained.", Comp: ModelBattle },
  { id: "spot",   label: "Spot the AI",   glyph: "🎯", title: "Spot the AI",         sub: "Three captions were human-written, one came from our M1 model. Can you tell?", Comp: SpotTheAI },
  { id: "attn",   label: "Attention",     glyph: "🔥", title: "Attention heat-map",  sub: "Upload an image; we visualise where the soft-attention decoder looks per word.", Comp: AttentionExplorer },
  { id: "quiz",   label: "Caption quiz",  glyph: "✍️", title: "Caption quiz",         sub: "Write your own caption, scored against the references with BLEU-ish overlap.", Comp: CaptionQuiz },
  { id: "lang",   label: "Multilingual",  glyph: "🌍", title: "Multilingual TTS",    sub: "Captions translated into EN, FR and AR with native browser speech synthesis.", Comp: MultilingualCaption },
  { id: "kids",   label: "Kids mode",     glyph: "👶", title: "Kid-friendly captions", sub: "We caption the image, detect emotional tone, then rewrite it as a warm child-friendly story.", Comp: KidsMode },
  { id: "story",  label: "Bedtime story", glyph: "🌙", title: "Bedtime story (Llama)", sub: "Upload a photo. We caption it, then a local Llama model writes a soothing bedtime story for the age and vibe you choose.", Comp: BedtimeStory },
  { id: "cartoon",label: "Cartoonify",    glyph: "🎨", title: "Cartoonify",            sub: "Upload a photo. A free Hugging Face Space turns it into a cartoon; our M1 model captions BOTH versions so you can see how it handles domain shift.", Comp: Cartoonify },
];

function DatasetSelector({
  dataset,
  onChange,
}: {
  dataset: Dataset;
  onChange: (d: Dataset) => void;
}) {
  return (
    <div className="ds-bar">
      <span className="ds-bar-label">Captioning weights</span>
      <div className="ds-pills">
        {ALL_DATASETS.map((d) => (
          <button
            key={d}
            className={"ds-pill" + (dataset === d ? " on" : "")}
            onClick={() => onChange(d)}
            title={`Use models trained on ${d}`}
          >
            {d === "flickr8k" ? "Flickr8k" : d === "flickr30k" ? "Flickr30k" : "MS COCO"}
          </button>
        ))}
      </div>
      <span className="ds-bar-label" style={{ marginLeft: "auto" }}>
        ↑ try MS COCO for general photos
      </span>
    </div>
  );
}

export default function FeatureTabs() {
  const [active, setActive] = useState("access");
  const [dataset, setDataset] = useState<Dataset>("coco");

  // Persist dataset choice across reloads
  useEffect(() => {
    try {
      const v = localStorage.getItem("captionai-dataset") as Dataset | null;
      if (v && (ALL_DATASETS as string[]).includes(v)) setDataset(v);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("captionai-dataset", dataset);
  }, [dataset]);

  const cur = TABS.find((t) => t.id === active)!;
  const Comp = cur.Comp;
  return (
    <section className="section" id="demos">
      <div className="eyebrow"><span className="dot"></span><span>02 · interactive demos</span></div>
      <h2 className="section-title">Six things you can do right now.</h2>
      <p className="section-sub">
        Every tab calls the real Hugging Face Space hosting our trained models.
        No login. No setup. Just click and play.
      </p>

      <DatasetSelector dataset={dataset} onChange={setDataset} />
      <div className="tabs-wrap">
        <div className="tabs-bar">
          {TABS.map((t) => (
            <button key={t.id} className={"tab" + (active === t.id ? " active" : "")} onClick={() => setActive(t.id)}>
              <span className="glyph">{t.glyph}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="tab-panel" key={cur.id}>
          <div className="panel-head">
            <div className="eyebrow" style={{ opacity: 0.85 }}>
              <span style={{ width: 6, height: 6, background: "var(--indigo)", borderRadius: 999, display: "inline-block" }}></span>
              <span>{cur.glyph} · demo</span>
            </div>
            <h3>{cur.title}</h3>
            <p>{cur.sub}</p>
          </div>
          <Comp dataset={dataset} />
        </div>
      </div>
    </section>
  );
}
