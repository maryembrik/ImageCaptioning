"use client";

import { useState } from "react";

type Member = {
  initial: string;
  name: string;
  color: string;
  role: string;
  photo?: string;
};

const TEAM: Member[] = [
  { initial: "A", name: "Amine Manai",   color: "#6366F1", role: "encoder · resnet",  photo: "/team/amines_manai.jpg" },
  { initial: "I", name: "Ines Chtioui",  color: "#10B981", role: "attention · lstm", photo: "/team/Ines_chtioui.jpg" },
  { initial: "M", name: "Maha Aloui",    color: "#F59E0B", role: "training · eval",   photo: "/team/maha_aloui.jpg" },
  { initial: "M", name: "Malek Chairat", color: "#F43F5E", role: "ui · gradio",       photo: "/team/malek_chairat.jpg" },
  { initial: "M", name: "Mariem Fersi",  color: "#06B6D4", role: "yolo · gpt-2",      photo: "/team/mariem_fersi.png" },
];

function MemberCard({ m }: { m: Member }) {
  const [err, setErr] = useState(false);
  return (
    <div className="member" style={{ ["--c" as any]: m.color }}>
      <div className="avatar" style={{ ["--c" as any]: m.color }}>
        {m.photo && !err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.photo}
            alt={m.name}
            onError={() => setErr(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "inherit",
            }}
          />
        ) : (
          m.initial
        )}
      </div>
      <div className="nm">{m.name}</div>
      <div className="role">{m.role}</div>
    </div>
  );
}

export default function TeamSection() {
  return (
    <section className="section" id="team">
      <div className="eyebrow">
        <span className="dot"></span>
        <span>04 · the people behind it</span>
      </div>
      <h2 className="section-title">The DataMinds team.</h2>
      <p className="section-sub">
        5 students. 1 paper reproduction. 9 trained models. 6 interactive demos.
      </p>
      <div className="team">
        {TEAM.map((m) => (
          <MemberCard m={m} key={m.name} />
        ))}
      </div>
      <div
        style={{
          marginTop: 32,
          padding: "18px 20px",
          border: "1px dashed var(--border-strong)",
          borderRadius: 14,
          color: "var(--text-2)",
          fontSize: 13.5,
          lineHeight: 1.6,
          maxWidth: 760,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          course
        </span>
        <div style={{ marginTop: 6 }}>
          ESPRIT · 4DS · Deep Learning paper reproduction project · academic
          year 2025–2026. Supervised by the Deep Learning faculty.
        </div>
      </div>
    </section>
  );
}
