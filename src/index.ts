export interface Env {
  AI: Ai;
}

// ─── Model catalog ───────────────────────────────────────────────────────────
// Sorted roughly: best free-tier value → higher quality / paid
const MODELS: { id: string; label: string; tag: string; tagColor: string; note: string }[] = [
  {
    id: "@cf/black-forest-labs/flux-1-schnell",
    label: "FLUX.1 Schnell",
    tag: "Free · Fast",
    tagColor: "#22c55e",
    note: "12B params · great all-rounder · recommended starting point",
  },
  {
    id: "@cf/lykon/dreamshaper-8-lcm",
    label: "Dreamshaper 8 LCM",
    tag: "Free · Artistic",
    tagColor: "#22c55e",
    note: "Stylised / painterly outputs · very fast LCM steps",
  },
  {
    id: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    label: "Stable Diffusion XL",
    tag: "Free",
    tagColor: "#22c55e",
    note: "Classic SDXL · solid photorealism · reliable",
  },
  {
    id: "@cf/bytedance/stable-diffusion-xl-lightning",
    label: "SDXL Lightning",
    tag: "Free · Ultra-fast",
    tagColor: "#22c55e",
    note: "2-step distilled SDXL · instant previews",
  },
];

// ─── HTML shell ───────────────────────────────────────────────────────────────
function renderHTML(modelsJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Workers AI · Image Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0c0c0f;
    --surface:   #141418;
    --border:    #232329;
    --border-hi: #3a3a44;
    --text:      #e8e8ed;
    --muted:     #888892;
    --accent:    #e8d5b7;
    --accent2:   #c4a882;
    --green:     #22c55e;
    --amber:     #f59e0b;
    --danger:    #f87171;
    --radius:    12px;
    --radius-lg: 20px;
  }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
  }

  /* ── Layout ── */
  .app {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100vh;
  }

  header {
    padding: 20px 32px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo {
    font-family: 'Instrument Serif', serif;
    font-size: 22px;
    font-style: italic;
    color: var(--accent);
    letter-spacing: -0.5px;
  }

  .logo span { color: var(--muted); font-style: normal; font-size: 13px; font-family: 'DM Mono', monospace; margin-left: 8px; }

  .main {
    display: grid;
    grid-template-columns: 360px 1fr;
    overflow: hidden;
    height: calc(100vh - 65px);
  }

  /* ── Sidebar ── */
  .sidebar {
    border-right: 1px solid var(--border);
    padding: 28px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  label {
    display: block;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  textarea {
    width: 100%;
    min-height: 130px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    padding: 14px 16px;
    resize: vertical;
    transition: border-color 0.15s;
    line-height: 1.7;
  }
  textarea:focus { outline: none; border-color: var(--border-hi); }
  textarea::placeholder { color: var(--muted); }

  /* Model cards */
  .model-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-card {
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    transition: border-color 0.15s, background 0.15s;
    position: relative;
  }
  .model-card:hover { border-color: var(--border-hi); }
  .model-card.selected {
    border-color: var(--accent2);
    background: #1c1a16;
  }
  .model-card input[type=radio] { position: absolute; opacity: 0; pointer-events: none; }

  .model-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .model-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .model-tag {
    font-size: 10px;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 99px;
    border: 1px solid;
  }
  .model-note { font-size: 11px; color: var(--muted); line-height: 1.5; }

  /* Generate button */
  .btn-generate {
    width: 100%;
    padding: 14px;
    background: var(--accent);
    color: #0c0c0f;
    border: none;
    border-radius: var(--radius);
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    text-transform: uppercase;
  }
  .btn-generate:hover:not(:disabled) { opacity: 0.88; }
  .btn-generate:active:not(:disabled) { transform: scale(0.98); }
  .btn-generate:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Canvas / output ── */
  .canvas {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, #1a1a22 0%, transparent 70%),
      var(--bg);
  }

  /* grid lines background */
  .canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: 0.35;
    pointer-events: none;
  }

  .output-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 700px;
    width: 100%;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--muted);
    text-align: center;
  }

  .placeholder-icon {
    width: 72px;
    height: 72px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    background: var(--surface);
  }

  .placeholder h2 {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: 28px;
    color: var(--text);
    font-weight: 400;
  }

  .placeholder p { font-size: 12px; max-width: 280px; }

  #result-img {
    width: 100%;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    box-shadow: 0 32px 80px rgba(0,0,0,0.7);
    display: none;
    animation: fadeIn 0.4s ease;
  }
  @keyframes fadeIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: none; } }

  .result-meta {
    display: none;
    width: 100%;
    padding: 14px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--muted);
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .btn-dl {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    padding: 6px 14px;
    cursor: pointer;
    transition: border-color 0.15s;
    text-decoration: none;
    display: inline-block;
    white-space: nowrap;
  }
  .btn-dl:hover { border-color: var(--border-hi); }

  /* Spinner */
  .spinner {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--muted);
    font-size: 12px;
  }

  .spin-ring {
    width: 40px;
    height: 40px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box {
    display: none;
    width: 100%;
    padding: 16px 18px;
    background: #1f1212;
    border: 1px solid #5a2222;
    border-radius: var(--radius);
    color: var(--danger);
    font-size: 12px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

  @media (max-width: 768px) {
    .main { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .sidebar { height: auto; }
    .canvas { min-height: 50vh; }
  }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="logo">Image Studio <span>· Workers AI</span></div>
  </header>

  <div class="main">
    <!-- Sidebar -->
    <div class="sidebar">
      <div>
        <label for="prompt-input">Prompt</label>
        <textarea
          id="prompt-input"
          placeholder="a photo of an astronaut riding a horse on mars, cinematic lighting, 8k"
          autocomplete="off"
          spellcheck="false"
        ></textarea>
      </div>

      <div>
        <label>Model</label>
        <div class="model-list" id="model-list"></div>
      </div>

      <button class="btn-generate" id="btn-gen" onclick="generate()">
        Generate image
      </button>
    </div>

    <!-- Canvas -->
    <div class="canvas">
      <div class="output-wrap">
        <!-- Placeholder -->
        <div class="placeholder" id="placeholder">
          <div class="placeholder-icon">✦</div>
          <h2>Your image will appear here</h2>
          <p>Enter a prompt and pick a model to get started. Free-tier models run on 10k neurons/day.</p>
        </div>

        <!-- Spinner -->
        <div class="spinner" id="spinner">
          <div class="spin-ring"></div>
          <span id="spinner-label">Generating…</span>
        </div>

        <!-- Error -->
        <div class="error-box" id="error-box"></div>

        <!-- Result -->
        <img id="result-img" alt="Generated image" />
        <div class="result-meta" id="result-meta">
          <span id="meta-text"></span>
          <a id="dl-link" class="btn-dl" download="image.png">↓ Download</a>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const MODELS = ${modelsJson};
let selectedModel = MODELS[0].id;
let genStart = 0;

// Render model cards
(function buildModelList() {
  const list = document.getElementById('model-list');
  MODELS.forEach((m, i) => {
    const card = document.createElement('label');
    card.className = 'model-card' + (i === 0 ? ' selected' : '');
    card.innerHTML = \`
      <input type="radio" name="model" value="\${m.id}" \${i === 0 ? 'checked' : ''} />
      <div class="model-header">
        <span class="model-name">\${m.label}</span>
        <span class="model-tag" style="color:\${m.tagColor};border-color:\${m.tagColor}40">\${m.tag}</span>
      </div>
      <div class="model-note">\${m.note}</div>
    \`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedModel = m.id;
    });
    list.appendChild(card);
  });
})();

// Allow Ctrl+Enter to generate
document.getElementById('prompt-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});

async function generate() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) { alert('Please enter a prompt.'); return; }

  const btn = document.getElementById('btn-gen');
  btn.disabled = true;

  // Show spinner, hide others
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('result-img').style.display = 'none';
  document.getElementById('result-meta').style.display = 'none';
  document.getElementById('error-box').style.display = 'none';

  const spinner = document.getElementById('spinner');
  spinner.style.display = 'flex';
  document.getElementById('spinner-label').textContent = 'Generating with ' + selectedModel.split('/').pop() + '…';
  genStart = Date.now();

  try {
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: selectedModel }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || res.statusText);
    }

    const blob = await res.blob();
    const elapsed = ((Date.now() - genStart) / 1000).toFixed(1);

    // Convert to base64 data URL — works reliably for both display and download
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    const img = document.getElementById('result-img');
    img.src = dataUrl;
    img.style.display = 'block';

    const dlLink = document.getElementById('dl-link');
    dlLink.href = dataUrl;
    dlLink.download = 'workers-ai-' + Date.now() + '.png';

    document.getElementById('meta-text').textContent =
      selectedModel.split('/').slice(-1)[0] + ' · ' + elapsed + 's';

    const meta = document.getElementById('result-meta');
    meta.style.display = 'flex';

  } catch (err) {
    const box = document.getElementById('error-box');
    box.textContent = '⚠ ' + (err.message || 'An unknown error occurred.');
    box.style.display = 'block';
    document.getElementById('placeholder').style.display = 'flex';
  } finally {
    spinner.style.display = 'none';
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;
}

// ─── Worker ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── GET / → serve UI ──────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(renderHTML(JSON.stringify(MODELS)), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    // ── POST /generate → run inference ────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/generate") {
      let body: { prompt?: string; model?: string };
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }

      const { prompt, model } = body;

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return new Response("prompt is required", { status: 400 });
      }

      // Validate model is in our catalog
      const validIds = MODELS.map((m) => m.id);
      const modelId = validIds.includes(model ?? "") ? model! : MODELS[0].id;

      try {
        // @ts-expect-error – AI binding types vary across Wrangler versions
        const result = await env.AI.run(modelId, { prompt: prompt.trim() });

        // result is ReadableStream or ArrayBuffer depending on CF runtime
        let imageData: Uint8Array;
        if (result instanceof ReadableStream) {
          const reader = result.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const total = chunks.reduce((s, c) => s + c.length, 0);
          imageData = new Uint8Array(total);
          let offset = 0;
          for (const c of chunks) { imageData.set(c, offset); offset += c.length; }
        } else {
          imageData = new Uint8Array(result as ArrayBuffer);
        }

        return new Response(imageData, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("AI inference error:", msg);
        return new Response(`Inference failed: ${msg}`, { status: 502 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};