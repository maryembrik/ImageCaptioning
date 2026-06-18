# Deploy — CaptionAI by DataMinds

Two pieces:

1. **Backend** — Hugging Face Space (Gradio + your trained `.pth` weights)
2. **Frontend** — Vercel (this Next.js project)

End-to-end deploy takes **~30 minutes** the first time. Both are free.

---

## 1. Hugging Face Space (backend)

### 1.1 Create the Space
1. Sign in at <https://huggingface.co>.
2. Click **+ New → Space**.
3. Fill in:
   - **Owner:** your username (e.g. `amine01119`)
   - **Space name:** `captionai`
   - **License:** MIT
   - **Select the Space SDK:** **Gradio**
   - **Hardware:** **CPU basic** (free, 2 vCPU, 16 GB RAM)
   - **Visibility:** Public
4. Click **Create Space**.

You'll land on an empty Space.

### 1.2 Push the backend files

Easiest: drag-drop via the web UI. Click **Files → Add file → Upload file** and
upload these from `captionai-site/hf_space/`:

- `app.py`
- `models.py`
- `inference.py`
- `requirements.txt`
- `README.md` (will overwrite the auto-generated one — that's fine)
- `.gitattributes`

### 1.3 Upload model weights (Git LFS, automatic)

Create a folder structure inside the Space matching what `app.py` expects:

```
checkpoints/
└── flickr8k/
    ├── best_model1.pth
    ├── best_model2.pth
    └── best_model3.pth
```

The 3 Flickr8k checkpoints total ~660 MB — fits comfortably in the free 1 GB
Git LFS quota. (Skip Flickr30k and COCO checkpoints for the live demo; they're
documented in the report.)

To upload them through the web UI:
1. Click **Files → Add file → Upload file**.
2. Drag each `.pth` file from `C:\Users\amine\Desktop\deep learning\checkpoints\flickr8k\`.
3. Type `checkpoints/flickr8k/best_modelN.pth` as the target path for each.
4. Hugging Face auto-converts large files to Git LFS thanks to `.gitattributes`.

(Or if you prefer the CLI: `huggingface-cli upload <username>/captionai <local-file> <remote-path>`.)

### 1.4 Watch the build

After upload, the Space rebuilds automatically. Click **Logs** — you should see
PyTorch installing, then `Loading 3 Flickr8k models on cpu …` then `Models loaded.`

**First boot: ~5–10 minutes.** Subsequent cold-starts: ~30 seconds.

### 1.5 Verify

Open the Space URL: `https://<username>-captionai.hf.space`

You should see a Gradio interface with 4 tabs (Caption / Caption all 3 /
Caption + attention / Random test image). Upload any image — confirm it returns
a caption.

The **JSON API** is automatically available at:
```
https://<username>-captionai.hf.space/api/caption
https://<username>-captionai.hf.space/api/caption_all
https://<username>-captionai.hf.space/api/caption_attention
https://<username>-captionai.hf.space/api/random_test_image
```

This is what the Vercel frontend calls.

---

## 2. Vercel (frontend)

### 2.1 Install the CLI (one time)

```cmd
npm install -g vercel
```

### 2.2 Set the backend URL

Create `captionai-site/.env.local`:

```
NEXT_PUBLIC_API_URL=https://<your-username>-captionai.hf.space
```

Replace `<your-username>` with whatever HF assigned (e.g. `amine01119`).

### 2.3 First deploy

```cmd
cd "C:\Users\amine\Desktop\deep learning\captionai-site"
vercel
```

Answer the CLI prompts:
- **Set up and deploy?** Y
- **Which scope?** your personal account
- **Link to existing project?** N
- **Project name:** `captionai` (or whatever you like)
- **Directory:** `./` (current)
- **Override settings?** N

Vercel detects Next.js automatically and deploys. After ~2 minutes you'll see:

```
✅ Production: https://captionai-xxxx.vercel.app
```

### 2.4 Add the env var on Vercel

Go to <https://vercel.com> → your project → **Settings → Environment Variables**:

- **Name:** `NEXT_PUBLIC_API_URL`
- **Value:** `https://<your-username>-captionai.hf.space`
- **Environments:** Production, Preview, Development

Then redeploy:
```cmd
vercel --prod
```

---

## 3. Verify end-to-end

Open your Vercel URL in a browser. You should see:

- A green dot in the top right: **"HF Space · live"**
- All 6 demo tabs functional:
  - **Accessibility** — webcam permission prompt → snapshot captioned by M1
  - **Model battle** — upload → 3 captions appear
  - **Spot the AI** — a real test image with 3 human refs + 1 M1 caption
  - **Attention** — upload → real heat-map per word
  - **Caption quiz** — write a caption, get scored
  - **Multilingual** — upload → EN + FR + AR captions

If you see **"HF Space · waking…"**, the Space is sleeping. Just wait 30 sec
for cold start, or hit refresh.

---

## 4. Troubleshooting

| Symptom | Fix |
|---|---|
| `Backend not configured` toast | `NEXT_PUBLIC_API_URL` env var not set in Vercel. Add it + redeploy. |
| `HF Space · waking…` for >2 min | Open the HF Space URL directly to trigger a wake-up. |
| 500 from `/api/caption` | Check HF Space logs — likely a checkpoint path mismatch. Verify `checkpoints/flickr8k/best_modelN.pth` exists. |
| Webcam doesn't start | Site must be served over HTTPS (Vercel is, localhost is exempt). |
| Translation says "(translation failed)" | MyMemory rate-limited (~5K chars/day per IP). Wait or fall back to copy-paste. |
| Slow inference (5+ seconds) | Free HF CPU tier — for live demo, upgrade to GPU ($0.50/h) or run the backend locally + tunnel. |

---

## 5. Local development with the real backend

```cmd
cd "C:\Users\amine\Desktop\deep learning\captionai-site"
echo NEXT_PUBLIC_API_URL=https://your-username-captionai.hf.space > .env.local
npm run dev
```

Open <http://localhost:3000>. All 6 demos call the real Space.

---

## 6. Local development with a LOCAL backend (fastest)

If you want sub-second inference for live demoing:

```cmd
:: terminal 1
cd "C:\Users\amine\Desktop\deep learning\captionai-site\hf_space"
pip install -r requirements.txt
mkdir checkpoints\flickr8k
copy "..\..\checkpoints\flickr8k\best_model*.pth" checkpoints\flickr8k\
python app.py
:: → runs Gradio on http://localhost:7860

:: terminal 2
cd "C:\Users\amine\Desktop\deep learning\captionai-site"
echo NEXT_PUBLIC_API_URL=http://localhost:7860 > .env.local
npm run dev
```

Open <http://localhost:3000>. Inference runs on your RTX 2050 → ~200 ms per
caption instead of ~3 s on HF CPU.

---

## 7. Team

DataMinds · ESPRIT 4DS · 2026

- Amine Manai
- Ines Chtioui
- Maha Aloui
- Malek Chairat
- Mariem Fersi


---

## 8. Ollama for Kids Mode + Bedtime Story (optional but recommended)

Both features auto-detect a local **Ollama** instance and use Llama 3.2 for
much better rewrites. If Ollama is not reachable, Kids Mode falls back to
the rule-based rewriter, and Bedtime Story shows a friendly setup notice.

### 8.1 Install & start Ollama

1. Download Ollama from <https://ollama.com> and install it.
2. Pull Llama 3.2 (3B is plenty for these tasks):

   ```cmd
   ollama pull llama3.2
   ```

3. Start the server (auto-starts on most installs):

   ```cmd
   ollama serve
   ```

### 8.2 Enable browser CORS (only if calls 404 / fail)

If the frontend's network tab shows the Ollama request blocked by CORS, set
`OLLAMA_ORIGINS` before launching:

```cmd
set OLLAMA_ORIGINS=*
ollama serve
```

Or in PowerShell:

```powershell
$env:OLLAMA_ORIGINS = "*"; ollama serve
```

### 8.3 Pin the model (optional)

In `captionai-site/.env.local`:

```
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_OLLAMA_MODEL=llama3.2
```

### 8.4 What happens when deployed to Vercel

Vercel sites cannot reach `localhost:11434` on your laptop. Two options:

| Option | How |
|---|---|
| Demo Ollama features **only locally** | Run `npm run dev` during demo; Vercel build still includes the tabs but they show "Ollama not detected" until you tunnel |
| Expose Ollama publicly via Cloudflare Tunnel | `cloudflared tunnel --url http://localhost:11434` → set `NEXT_PUBLIC_OLLAMA_URL` in Vercel env vars to the tunnel URL |

For a prof demo on your laptop, **local-only is fine** — you'll be running
`npm run dev` while presenting anyway.
