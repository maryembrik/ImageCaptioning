# CaptionAI · by DataMinds

Live demo site for the **Show, Attend and Tell** image-captioning reproduction
by team DataMinds (ESPRIT 4DS, 2026).

## What's inside

- **Next.js 14** App Router project (TypeScript)
- **6 interactive demos** of the trained image-captioning models:
  1. 🦮 Accessibility mode (voice + camera + TTS)
  2. ⚔️  Multi-model battle (M1 vs M2 vs M3 vote)
  3. 🎯 Spot the AI (Turing test on captions)
  4. 🔥 Attention heat-map explorer
  5. ✍️  Caption quiz (write a caption, get BLEU)
  6. 🌍 Multilingual captions (EN / FR / AR + TTS)
- **Mock mode by default** — the API client falls back to mock data so the UI
  works without any backend.

## Quick start (local dev)

```bash
cd captionai-site
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Wiring it to the real model (Hugging Face Space)

1. Deploy the Gradio backend to a Hugging Face Space (see `../hf_space/`).
2. Create a `.env.local` file:

   ```
   NEXT_PUBLIC_API_URL=https://your-username-captionai.hf.space
   ```

3. Restart `npm run dev`. All six demos now call the real model.

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set `NEXT_PUBLIC_API_URL` in **Vercel → Project → Settings → Environment Variables**
before promoting to production.

## Project structure

```
captionai-site/
├── app/
│   ├── layout.tsx          # global head, fonts, body
│   ├── page.tsx            # composes Nav + Hero + ... + Footer
│   └── globals.css         # all styles (ported from Claude Design)
├── components/
│   ├── Nav.tsx
│   ├── Hero.tsx            # hero + animated KPI cards
│   ├── FeatureTabs.tsx     # the 6 demo tabs
│   ├── TechnicalDetails.tsx
│   ├── TeamSection.tsx
│   └── Footer.tsx
├── lib/
│   ├── api.ts              # HF Space client (with mock fallback)
│   └── confetti.ts         # vote-button confetti animation
└── package.json
```

## The DataMinds team

- Amine Manai
- Ines Chtioui
- Maha Aloui
- Malek Chairat
- Mariem Fersi

## License

MIT.
