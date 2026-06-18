"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";
import { speakText } from "./CaptionDisplay";
import {
  chat,
  isOllamaAvailable,
  OLLAMA_MODEL,
  type ChatMessage,
} from "@/lib/llama";

const SUGGESTIONS = [
  "Who is our teacher?",
  "Who built CaptionAI?",
  "What is soft attention?",
  "How well did your COCO model do?",
  "Tell me about Mariem.",
  "Explain BLEU-4 in one sentence.",
];

/**
 * Floating chatbot widget — pinned to the bottom-right of every page.
 *
 *  - Closed state: a circular launcher button.
 *  - Open state: a 380×560 chat panel with voice input, read-aloud, suggestions.
 *
 * Talks to a local Llama 3.2 instance via Ollama. Falls back to a banner if
 * Ollama isn't running.
 */
export default function ChatWidget() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me anything about CaptionAI, the DataMinds team, or our teacher Dr Sonia Mesbah.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ollamaUp, setOllamaUp] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const recRef = useRef<any>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Re-check Ollama every 30 s so opening the widget after a delay still works
  useEffect(() => {
    isOllamaAvailable().then(setOllamaUp);
    const t = setInterval(() => isOllamaAvailable().then(setOllamaUp), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, busy, open]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setBusy(true);

    try {
      if (!ollamaUp) throw new Error("Ollama is not running. Start it: `ollama serve`");
      const reply = await chat(newMessages.filter((m) => m.role !== "system"));
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      if (autoSpeak && reply) void speakText(reply, "en");
      if (!open) setUnread(true);
    } catch (e: any) {
      push("err", "Chat failed: " + (e?.message ?? e));
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the local Ollama model. Make sure `ollama serve` is running and the model `" +
            OLLAMA_MODEL +
            "` is pulled.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const startVoiceInput = () => {
    if (listening) {
      recRef.current?.stop?.();
      return;
    }
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      push("err", "Voice recognition not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    recRef.current = rec;
    setListening(true);
    let final = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((final + " " + interim).trim());
    };
    rec.onerror = (ev: any) => {
      setListening(false);
      if (ev.error !== "no-speech")
        push("err", "Voice recognition error: " + ev.error);
    };
    rec.onend = () => {
      setListening(false);
      if (final.trim()) setTimeout(() => send(final.trim()), 100);
    };
    rec.start();
  };

  const openWidget = () => {
    setOpen(true);
    setUnread(false);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Cleared! Ask me anything about CaptionAI, the team, or our teacher.",
      },
    ]);
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        className={"chat-launcher" + (open ? " open" : "")}
        onClick={() => (open ? setOpen(false) : openWidget())}
        aria-label={open ? "Close chat" : "Open chat"}
        title={open ? "Close chat" : "Ask CaptionAI"}
      >
        {open ? "✕" : "💬"}
        {!open && unread && <span className="chat-launcher-dot" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-widget" role="dialog" aria-label="Ask CaptionAI">
          <div className="chat-widget-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="chat-widget-icon">🤖</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Ask CaptionAI</div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    color: "var(--text-3)",
                  }}
                >
                  {ollamaUp === true
                    ? `local · ${OLLAMA_MODEL}`
                    : ollamaUp === false
                    ? "ollama offline"
                    : "checking ollama…"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="chat-widget-action"
                onClick={clearChat}
                title="Clear chat"
              >
                ⟲
              </button>
              <button
                className="chat-widget-action"
                onClick={() => setOpen(false)}
                title="Minimise"
              >
                –
              </button>
            </div>
          </div>

          {ollamaUp === false && (
            <div
              style={{
                margin: "8px 14px 0",
                padding: "8px 12px",
                border: "1px solid rgba(244,63,94,0.4)",
                borderRadius: 10,
                background: "rgba(244,63,94,0.08)",
                fontSize: 12,
                color: "var(--text-2)",
                lineHeight: 1.5,
              }}
            >
              ⚠ Ollama is not reachable. Run <code>ollama serve</code> +{" "}
              <code>ollama pull {OLLAMA_MODEL}</code>.
            </div>
          )}

          <div className="chat-feed chat-feed-widget" ref={feedRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`chat-msg ${m.role}`}>
                <div className="chat-avatar">{m.role === "user" ? "🧑" : "🤖"}</div>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="chat-msg assistant">
                <div className="chat-avatar">🤖</div>
                <div className="chat-bubble">
                  <div className="chat-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "0 14px 14px" }}>
            {messages.filter((m) => m.role === "user").length === 0 && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="chat-suggest-pill"
                    onClick={() => send(s)}
                    disabled={busy}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-input-row" style={{ marginTop: 8 }}>
              <textarea
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  listening ? "Listening…" : "Type a message…"
                }
                disabled={busy}
                rows={2}
              />
              <button
                className={"chat-mic" + (listening ? " listening" : "")}
                onClick={startVoiceInput}
                disabled={busy}
                title={listening ? "Stop listening" : "Voice input"}
                style={{ width: 40, height: 40, fontSize: 16 }}
              >
                {listening ? "■" : "🎤"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => send()}
                disabled={busy || !input.trim()}
                style={{ padding: "0 12px", borderRadius: 10, height: 40 }}
              >
                ➤
              </button>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
              <span>🔊 read replies aloud</span>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
