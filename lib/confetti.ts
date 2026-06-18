export function fireConfetti(x?: number, y?: number) {
  if (typeof window === "undefined") return;
  x = x ?? window.innerWidth / 2;
  y = y ?? window.innerHeight / 3;
  const root = document.getElementById("confetti-root");
  if (!root) return;
  const colors = [
    "#6366F1",
    "#10B981",
    "#F59E0B",
    "#F43F5E",
    "#06B6D4",
    "#F8FAFC",
  ];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.background = colors[i % colors.length];
    el.style.left = x + "px";
    el.style.top = y + "px";
    const ang = Math.random() * Math.PI - Math.PI / 2;
    const vel = 280 + Math.random() * 320;
    const dx = Math.cos(ang) * vel;
    const dy = Math.sin(ang) * vel;
    const rot = (Math.random() - 0.5) * 720;
    root.appendChild(el);
    const anim = el.animate(
      [
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 600}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1400 + Math.random() * 600,
        easing: "cubic-bezier(.2,.7,.2,1)",
      }
    );
    anim.onfinish = () => el.remove();
  }
}
