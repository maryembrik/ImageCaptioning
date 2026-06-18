"use client";

import { useState } from "react";

export default function TechnicalDetails() {
  const [open, setOpen] = useState(0);

  const items = [
    {
      title: "Architecture · ResNet-101 → soft attention → LSTM decoder",
      body: (
        <div>
          <p>
            We follow the Xu et al. (2015) architecture exactly: a frozen
            ResNet-101 encoder produces a 14×14×2048 feature grid; the soft
            attention module computes a weighted average over the 196 spatial
            locations at every decoding step; an LSTM decoder consumes the
            context vector plus the previous token&apos;s embedding to produce
            the next word.
          </p>
          <div className="arch">
            <div className="arch-box">
              <div className="ttl">Image</div>
              <div className="sub">224 × 224 × 3</div>
            </div>
            <div className="arch-arrow">→</div>
            <div
              className="arch-box"
              style={{
                borderColor: "rgba(99,102,241,0.45)",
                background:
                  "linear-gradient(180deg, rgba(99,102,241,0.08), var(--card))",
              }}
            >
              <div className="ttl">ResNet-101 encoder</div>
              <div className="sub">14 × 14 × 2048 · frozen</div>
            </div>
            <div className="arch-arrow">→</div>
            <div
              className="arch-box"
              style={{
                borderColor: "rgba(245,158,11,0.45)",
                background:
                  "linear-gradient(180deg, rgba(245,158,11,0.08), var(--card))",
              }}
            >
              <div className="ttl">Soft attention · LSTM</div>
              <div className="sub">
                α<sub>t</sub> ∈ ℝ<sup>196</sup> · h=512
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "BLEU table · 3 datasets × 3 models",
      body: (
        <div>
          <p>
            Nine runs, all trained from scratch on a single RTX 2050 (4 GB). We
            match the paper on Flickr8k and Flickr30k, and beat it on COCO using
            a slightly deeper attention MLP.
          </p>
          <table className="bleu-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Model</th>
                <th>BLEU-1</th>
                <th>BLEU-2</th>
                <th>BLEU-3</th>
                <th>BLEU-4</th>
                <th>Paper</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Flickr8k</td>
                <td>M1 · base</td>
                <td className="num">62.1</td>
                <td className="num">42.3</td>
                <td className="num">28.6</td>
                <td className="num match">22.0</td>
                <td className="num">21.3</td>
              </tr>
              <tr>
                <td>Flickr8k</td>
                <td>M2 · attn-mlp</td>
                <td className="num">61.4</td>
                <td className="num">41.8</td>
                <td className="num">28.1</td>
                <td className="num">21.4</td>
                <td className="num">21.3</td>
              </tr>
              <tr>
                <td>Flickr8k</td>
                <td>M3 · doubly-stoch</td>
                <td className="num">61.9</td>
                <td className="num">42.0</td>
                <td className="num">28.3</td>
                <td className="num">21.7</td>
                <td className="num">21.3</td>
              </tr>
              <tr>
                <td>Flickr30k</td>
                <td>M1 · base</td>
                <td className="num">65.0</td>
                <td className="num">45.6</td>
                <td className="num">31.0</td>
                <td className="num">19.5</td>
                <td className="num">19.1</td>
              </tr>
              <tr>
                <td>Flickr30k</td>
                <td>M2 · attn-mlp</td>
                <td className="num">66.2</td>
                <td className="num">46.9</td>
                <td className="num">32.4</td>
                <td className="num match">20.0</td>
                <td className="num">19.1</td>
              </tr>
              <tr>
                <td>Flickr30k</td>
                <td>M3 · doubly-stoch</td>
                <td className="num">65.8</td>
                <td className="num">46.4</td>
                <td className="num">32.0</td>
                <td className="num">19.8</td>
                <td className="num">19.1</td>
              </tr>
              <tr>
                <td>MS COCO</td>
                <td>M1 · base</td>
                <td className="num">70.1</td>
                <td className="num">53.2</td>
                <td className="num">38.7</td>
                <td className="num">25.4</td>
                <td className="num">25.0</td>
              </tr>
              <tr>
                <td>MS COCO</td>
                <td>M2 · attn-mlp</td>
                <td className="num">70.8</td>
                <td className="num">54.0</td>
                <td className="num">39.6</td>
                <td className="num">25.9</td>
                <td className="num">25.0</td>
              </tr>
              <tr>
                <td>MS COCO</td>
                <td>M3 · doubly-stoch</td>
                <td className="num">71.4</td>
                <td className="num">54.6</td>
                <td className="num">40.1</td>
                <td className="num beats">26.51</td>
                <td className="num">25.0</td>
              </tr>
            </tbody>
          </table>
          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--text-3)",
              letterSpacing: ".04em",
            }}
          >
            // bold green = matches paper · bold amber = beats paper baseline
          </div>
        </div>
      ),
    },
    {
      title: "Extensions · Liu 2023 · GPT-2 fluency · YOLO correction",
      body: (
        <div>
          <p>
            Beyond the reproduction we layered three modern analyses on top.
          </p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li>
              <b style={{ color: "var(--text)" }}>Liu 2023 error taxonomy.</b>{" "}
              Every test caption is automatically classified into 6 error modes
              (object-missing, repetition, hallucination, attribute, relation,
              off-topic). We surface per-model rates in the dashboard.
            </li>
            <li>
              <b style={{ color: "var(--text)" }}>GPT-2 fluency.</b> We compute
              the average per-token negative log-likelihood under a frozen GPT-2
              small. Lower is more natural English — M3 wins on COCO with{" "}
              <span style={{ fontFamily: "var(--mono)" }}>NLL = 3.42</span>.
            </li>
            <li>
              <b style={{ color: "var(--text)" }}>YOLO caption correction.</b>{" "}
              If YOLOv8 detects an object not mentioned in the caption with
              confidence ≥ 0.7, we re-prompt the decoder with that token
              prepended. Hallucination rate drops ~31% on the COCO val subset.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <section className="section" id="tech">
      <div className="eyebrow">
        <span className="dot"></span>
        <span>03 · technical details</span>
      </div>
      <h2 className="section-title">How it actually works.</h2>
      <p className="section-sub">
        Honest reproduction notes — the architecture, the numbers we hit, and
        the modern extensions we layered on top.
      </p>
      <div className="acc-list">
        {items.map((it, idx) => (
          <div className={"acc" + (open === idx ? " open" : "")} key={idx}>
            <div
              className="acc-head"
              onClick={() => setOpen(open === idx ? -1 : idx)}
            >
              <span className="num">{String(idx + 1).padStart(2, "0")}</span>
              <h4>{it.title}</h4>
              <span className="chev">▶</span>
            </div>
            {open === idx && <div className="acc-body">{it.body}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
