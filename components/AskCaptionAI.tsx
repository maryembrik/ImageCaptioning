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
  "Who built CaptionAI?",
  "What is soft attention?",
  "How well did your COCO model do?",
  "Explain BLEU-4 in one sentence.",
  "Tell me about Mariem.",
  "Why did Model 3 fail?",
];

export default function AskCaptionAI() {
  const { push } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm CaptionAI's assistant — ask me anything about the project, the team, or how the model works. I can also help you understand the demos.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ollamaUp, setOllamaUp] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const recRef = useRef<any>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Check Ollama on mount
  useEffect(() => {
    isOllamaAvailable().then(setOllamaUp);
  }, []);

  // Auto-scroll feed to bottom on new message
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, busy]);

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
      if (!ollamaUp) {
        throw new Error("Ollama is not running. Start it: `ollama serve`");
      }
      // Only send the actual conversation (chat() prepends the system prompt)
      const reply = await chat(
        newMessages.filter((m) => m.role !== "system")
      );
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      if (autoSpeak && reply) {
        // Run async TTS in the background — no await so the UI stays responsive
        void speakText(reply, "en");
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      push("err", "Chat failed: " + msg);
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
      if (ev.error !== "no-speech") {
        push("err", "Voice recognition error: " + ev.error);
      }
    };
    rec.onend = () => {
      setListening(false);
      // Auto-send if we got a result
      if (final.trim()) {
        setTimeout(() => send(final.trim()), 100);
      }
    };
    rec.start();
  };

  const clear = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Cleared! Ask me anything about CaptionAI, the DataMinds team, or how the model works.",
      },
    ]);
  };

  return (
    <div>
      {ollamaUp === false && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            border: "1px solid rgba(244,63,94,0.4)",
            borderRadius: 10,
            background: "rgba(244,63,94,0.08)",
            fontSize: 13,
            color: "var(--text-2)",
          }}
        >
          ⚠ Ollama is not reachable. Run <code>ollama serve</code> and{" "}
          <code>ollama pull {OLLAMA_MODEL}</code>, then refresh this page.
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-feed" ref={feedRef}>
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-msg ${m.role}`}>
              <div className="chat-avatar">
                {m.role === "user" ? "🧑" : "🤖"}
              </div>
              <div className="chat-bubble">{m.content}</div>
            </div>
          ))}
          {busy && (
            <div className="chat-msg assistant">
              <div className="chat-avatar">🤖</div>
              <div className="chat-bubble">
                <div className="chat-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          {/* Quick suggestion pills (hide once user has sent something) */}
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

          <div className="chat-input-row" style={{ marginTop: 10 }}>
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
                listening
                  ? "Listening… (release voice mic when done)"
                  : "Ask me anything — about the team, the model, or the project."
              }
              disabled={busy}
            />
            <button
              className={"chat-mic" + (listening ? " listening" : "")}
              onClick={startVoiceInput}
              title={listening ? "Stop listening" : "Voice input"}
              disabled={busy}
            >
              {listening ? "■" : "🎤"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              style={{ padding: "0 16px", borderRadius: 12 }}
            >
              Send
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--text-3)",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
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
            <span>
              {ollamaUp
                ? `local · ${OLLAMA_MODEL}`
                : ollamaUp === null
                ? "checking ollama…"
                : "ollama offline"}
              {" · "}
              <button
                onClick={clear}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  textDecoration: "underline",
                }}
              >
                clear chat
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
