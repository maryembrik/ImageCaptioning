export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          Built by <b style={{ color: "var(--text)" }}>Mariem Brik</b> · 2026
        </div>
        <div className="footer-links">
          <a href="#">Hugging Face Space ↗</a>
          <a
            href="https://arxiv.org/abs/1502.03044"
            target="_blank"
            rel="noreferrer"
          >
            Xu 2015 paper ↗
          </a>
          <a href="#">Liu 2023 paper ↗</a>
        </div>
      </div>
      <div className="footer-foot">
        Trained on RTX 2050 4GB · ResNet-101 encoder · Soft-attention LSTM
        decoder · Open source under MIT
      </div>
    </footer>
  );
}
