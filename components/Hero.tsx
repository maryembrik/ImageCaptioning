"use client";

import { useEffect, useState } from "react";

function useCountUp(target: number, durationMs = 1200, start = 0) {
  const [v, setV] = useState(start);
  useEffect(() => {
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start]);
  return v;
}

type KpiProps = {
  label: string;
  value: number;
  decimals?: number;
  tag: string;
  tagKind?: "neutral" | "ok" | "beats";
  foot: string;
};

function Kpi({
  label,
  value,
  decimals = 2,
  tag,
  tagKind = "neutral",
  foot,
}: KpiProps) {
  const v = useCountUp(value, 1400);
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{v.toFixed(decimals)}</div>
      <div className="kpi-foot">
        <span className={`tag ${tagKind}`}>{tag}</span>
        <span>{foot}</span>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="section hero" id="top">
      <div className="reveal in">
        <div className="hero-badge">
          <span className="pill">NEW</span>
          <span>v1.0 · Show, Attend and Tell · reproduced from scratch</span>
        </div>
        <h1>
          <span className="grad">
            Teaching machines
            <br />
            to describe what they see.
          </span>
        </h1>
        <p className="lede">
          A faithful reproduction of{" "}
          <em>Xu et al. (2015) — Show, Attend and Tell</em>, trained on
          Flickr8k, Flickr30k and MS COCO. Plus six interactive demos you can
          play with right now.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-primary" href="#demos">
            <span>Try the demo</span>
            <span style={{ fontFamily: "var(--mono)" }}>→</span>
          </a>
          <a
            className="btn btn-ghost"
            href="https://arxiv.org/abs/1502.03044"
            target="_blank"
            rel="noreferrer"
          >
            <span>📄</span>
            <span>View paper</span>
          </a>

        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="Flickr8k · BLEU-4"
          value={22.0}
          tag="matches paper"
          tagKind="ok"
          foot="Xu 2015 reports 21.3 · we hit 22.0"
        />
        <Kpi
          label="COCO · BLEU-4"
          value={26.51}
          tag="beats paper"
          tagKind="beats"
          foot="Xu 2015 reports 25.0 · +1.5 over baseline"
        />
        <Kpi
          label="Models compared"
          value={3}
          decimals={0}
          tag="all trained"
          tagKind="neutral"
          foot="3 architectures × 3 datasets · 9 runs"
        />
      </div>
    </section>
  );
}
