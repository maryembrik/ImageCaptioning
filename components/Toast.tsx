"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "err" | "ok" | "info";
type ToastMsg = { id: number; kind: ToastKind; text: string };

const ToastCtx = createContext<{ push: (kind: ToastKind, text: string) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => {
      setItems((xs) => xs.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {items.map((it) => (
        <div key={it.id} className={`toast ${it.kind}`}>{it.text}</div>
      ))}
    </ToastCtx.Provider>
  );
}
