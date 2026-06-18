import ModelStatusBadge from "./ModelStatusBadge";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#top" className="brand">
          <span className="brand-mark"></span>
          <span>CaptionAI</span>
        </a>
        <nav className="nav-links">
          <a href="#demos">Demos</a>
          <a href="#tech">Technical</a>
          <a
            href="https://arxiv.org/abs/1502.03044"
            target="_blank"
            rel="noreferrer"
          >
            Paper ↗
          </a>
        </nav>
        <ModelStatusBadge />
      </div>
    </header>
  );
}
