"use client";

import { useEffect, useState } from "react";
import { API_URL, pingBackend } from "@/lib/api";

export default function ModelStatusBadge() {
  const [state, setState] = useState<"checking" | "live" | "down" | "unset">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!API_URL) {
        if (!cancelled) setState("unset");
        return;
      }
      const ok = await pingBackend();
      if (!cancelled) setState(ok ? "live" : "down");
    }
    check();
    const t = setInterval(check, 60_000); // recheck every minute
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const label =
    state === "live"
      ? "HF Space · live"
      : state === "down"
      ? "HF Space · waking…"
      : state === "unset"
      ? "Backend not configured"
      : "Checking…";

  const dotClass =
    state === "live" ? "dot-live" : state === "down" ? "dot-warn" : "dot-err";

  return (
    <span className="status-pill">
      <span className={dotClass}></span>
      <span>{label}</span>
    </span>
  );
}
