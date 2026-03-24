/**
 * Cloudflare Workers AI — Text-to-Image Playground
 *
 * Drop this file in as src/index.js (replacing the original).
 * Make sure your wrangler.toml has the AI binding:
 *
 *   [ai]
 *   binding = "AI"
 *
 * Models used are all on the free daily neuron allowance (10,000/day).
 */

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Image Forge</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0b0c0e;
    --surface:  #131519;
    --border:   #222529;
    --accent:   #e8ff47;
    --accent2:  #ff6b35;
    --text:     #e8e9eb;
    --muted:    #6b7280;
    --radius:   6px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  /* Noise texture overlay */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  header {
    position: relative;
    z-index: 1;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo-mark {
    width: 32px; height: 32px;
    background: var(--accent);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    flex-shrink: 0;
  }

  header h1 {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  header h1 span { color: var(--accent); }

  .badge {
    margin-left: auto;
    font-family: 'DM Mono', monospace;
    font-size: 0.65rem;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  main {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 380px 1fr;
    min-height: 0;
  }

  /* ── Left panel ── */
  .panel {
    border-right: 1px solid var(--border);
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
  }

  .field { display: flex; flex-direction: column; gap: 0.5rem; }

  label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  textarea {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    padding: 0.75rem 1rem;
    resize: vertical;
    min-height: 110px;
    transition: border-color 0.15s;
    outline: none;
  }
  textarea:focus { border-color: var(--accent); }
  textarea::placeholder { color: var(--muted); }

  .model-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .model-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .model-card:hover { border-color: #3a3d42; }
  .model-card.active {
    border-color: var(--accent);
    background: rgba(232, 255, 71, 0.05);
  }

  .model-radio {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: transparent;
    flex-shrink: 0;
    transition: border-color 0.15s, background 0.15s;
  }
  .model-card.active .model-radio {
    border-color: var(--accent);
    background: var(--accent);
  }

  .model-info { flex: 1; min-width: 0; }
  .model-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .model-desc {
    font-family: 'DM Mono', monospace;
    font-size: 0.65rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }

  /* Advanced params */
  .params-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: var(--muted);
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .params-toggle:hover { color: var(--text); }
  .params-toggle svg { transition: transform 0.2s; }
  .params-toggle.open svg { transform: rotate(180deg); }

  .params-body {
    display: none;
    flex-direction: column;
    gap: 1rem;
  }
  .params-body.open { display: flex; }

  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

  select, input[type="number"] {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    padding: 0.6rem 0.75rem;
    outline: none;
    width: 100%;
    transition: border-color 0.15s;
    -moz-appearance: textfield;
  }
  select:focus, input[type="number"]:focus { border-color: var(--accent); }
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }

  /* Range slider */
  .slider-wrap { display: flex; align-items: center; gap: 0.75rem; }
  input[type="range"] {
    flex: 1;
    appearance: none;
    background: var(--border);
    height: 3px;
    border-radius: 99px;
    outline: none;
    cursor: pointer;
  }
  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }
  .slider-val {
    font-family: 'DM Mono', monospace;
    font-size: 0.75rem;
    color: var(--accent);
    min-width: 2ch;
    text-align: right;
  }

  /* Generate button */
  .btn-generate {
    width: 100%;
    background: var(--accent);
    color: #0b0c0e;
    border: none;
    border-radius: var(--radius);
    font-family: 'Syne', sans-serif;
    font-size: 0.9rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    padding: 0.9rem 1.5rem;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: auto;
  }
  .btn-generate:hover { opacity: 0.9; }
  .btn-generate:active { transform: scale(0.98); }
  .btn-generate:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .btn-generate .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #0b0c0e;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: none;
  }
  .btn-generate.loading .btn-text { display: none; }
  .btn-generate.loading .spinner { display: block; }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Right canvas ── */
  .canvas {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--bg);
    position: relative;
    overflow: hidden;
  }

  /* Dot-grid background */
  .canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, #222529 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.5;
  }

  .canvas-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 640px;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
  }

  .placeholder-icon {
    width: 72px; height: 72px;
    border: 2px dashed var(--border);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }

  .placeholder p {
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    color: var(--muted);
    line-height: 1.6;
  }

  .result-wrap { display: none; flex-direction: column; align-items: center; gap: 1rem; width: 100%; }
  .result-wrap.visible { display: flex; }

  #output-img {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--border), 0 24px 64px rgba(0,0,0,0.5);
    display: block;
  }

  .img-meta {
    font-family: 'DM Mono', monospace;
    font-size: 0.7rem;
    color: var(--muted);
    text-align: center;
  }

  .btn-download {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.5rem 1.25rem;
    cursor: pointer;
    transition: border-color 0.15s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .btn-download:hover { border-color: var(--accent); color: var(--accent); }

  .error-msg {
    display: none;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    color: var(--accent2);
    background: rgba(255,107,53,0.07);
    border: 1px solid rgba(255,107,53,0.25);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    text-align: center;
    width: 100%;
  }
  .error-msg.visible { display: block; }

  /* Progress bar */
  .progress-bar-wrap {
    width: 100%;
    max-width: 320px;
    display: none;
  }
  .progress-bar-wrap.visible { display: block; }
  .progress-bar {
    height: 3px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    border-radius: 99px;
    animation: indeterminate 1.4s ease-in-out infinite;
    transform-origin: left;
  }
  @keyframes indeterminate {
    0%   { transform: translateX(-100%) scaleX(0.3); }
    50%  { transform: translateX(30%)  scaleX(0.6); }
    100% { transform: translateX(100%) scaleX(0.3); }
  }
  .progress-label {
    font-family: 'DM Mono', monospace;
    font-size: 0.65rem;
    color: var(--muted);
    text-align: center;
    margin-top: 0.5rem;
    letter-spacing: 0.05em;
  }

  @media (max-width: 720px) {
    main { grid-template-columns: 1fr; }
    .panel { border-right: none; border-bottom: 1px solid var(--border); }
    .canvas { min-height: 50vh; }
  }
</style>
</head>
<body>

<header>
  <div class="logo-mark"></div>
  <h1>Image<span>Forge</span></h1>
  <span class="badge">Workers AI</span>
</header>

<main>
  <!-- ── Left panel ── -->
  <aside class="panel">

    <div class="field">
      <label>Prompt</label>
      <textarea id="prompt" placeholder="A cinematic shot of a lone astronaut walking across a rust-coloured desert at dusk, dust haze, golden hour, award-winning photography…" rows="5"></textarea>
    </div>

    <div class="field">
      <label>Model</label>
      <div class="model-grid" id="model-grid">
        <!-- populated by JS -->
      </div>
    </div>

    <!-- Advanced params -->
    <div class="field">
      <button class="params-toggle" id="params-toggle" onclick="toggleParams()">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Parameters
      </button>
      <div class="params-body" id="params-body">
        <div class="row-2">
          <div class="field">
            <label>Width</label>
            <select id="width">
              <option value="512">512 px</option>
              <option value="768">768 px</option>
              <option value="1024" selected>1024 px</option>
            </select>
          </div>
          <div class="field">
            <label>Height</label>
            <select id="height">
              <option value="512">512 px</option>
              <option value="768">768 px</option>
              <option value="1024" selected>1024 px</option>
            </select>
          </div>
        </div>

        <div class="field" id="steps-field">
          <label>Steps <span id="steps-label" style="color:var(--accent);font-family:'DM Mono',monospace;font-size:0.7rem;"></span></label>
          <div class="slider-wrap">
            <input type="range" id="steps" min="1" max="20" value="4"
              oninput="document.getElementById('steps-val').textContent=this.value" />
            <span class="slider-val" id="steps-val">4</span>
          </div>
        </div>

        <div class="field" id="guidance-field">
          <label>Guidance scale</label>
          <div class="slider-wrap">
            <input type="range" id="guidance" min="1" max="20" value="7" step="0.5"
              oninput="document.getElementById('guidance-val').textContent=this.value" />
            <span class="slider-val" id="guidance-val">7</span>
          </div>
        </div>

        <div class="field">
          <label>Negative prompt</label>
          <textarea id="neg-prompt" placeholder="blurry, low quality, oversaturated…" rows="2" style="min-height:60px;"></textarea>
        </div>
      </div>
    </div>

    <button class="btn-generate" id="generate-btn" onclick="generate()">
      <div class="spinner"></div>
      <span class="btn-text">Generate →</span>
    </button>

  </aside>

  <!-- ── Right canvas ── -->
  <section class="canvas">
    <div class="canvas-inner">

      <div class="placeholder" id="placeholder">
        <div class="placeholder-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="11" cy="13" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4 22l6-5 5 4 4-3 9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p>Your image will appear here.<br/>Write a prompt and hit Generate.</p>
      </div>

      <div class="progress-bar-wrap" id="progress">
        <div class="progress-bar"><div class="progress-bar-fill"></div></div>
        <div class="progress-label" id="progress-label">Generating…</div>
      </div>

      <div class="error-msg" id="error-msg"></div>

      <div class="result-wrap" id="result">
        <img id="output-img" alt="Generated image" />
        <div class="img-meta" id="img-meta"></div>
        <a class="btn-download" id="download-btn" download="imageforge.png">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download
        </a>
      </div>

    </div>
  </section>
</main>

<script>
// ── Model registry ──────────────────────────────────────────────────────────
const MODELS = [
  {
    id:    '@cf/black-forest-labs/flux-1-schnell',
    name:  'FLUX.1 Schnell',
    desc:  'Fast · High quality · Recommended',
    steps: { default: 4, min: 1, max: 8, locked: false },
    supportsGuidance: false,
    supportsNeg: false,
  },
  {
    id:    '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name:  'Stable Diffusion XL',
    desc:  'Classic · Good for stylized art',
    steps: { default: 20, min: 1, max: 20, locked: false },
    supportsGuidance: true,
    supportsNeg: true,
  },
  {
    id:    '@cf/lykon/dreamshaper-8-lcm',
    name:  'DreamShaper 8 LCM',
    desc:  'Creative · Vibrant · Fast',
    steps: { default: 8, min: 1, max: 10, locked: false },
    supportsGuidance: false,
    supportsNeg: false,
  },
];

let selectedModel = MODELS[0];

// ── Build model cards ───────────────────────────────────────────────────────
const grid = document.getElementById('model-grid');
MODELS.forEach((m, i) => {
  const card = document.createElement('div');
  card.className = 'model-card' + (i === 0 ? ' active' : '');
  card.dataset.id = m.id;
  card.innerHTML = \`
    <div class="model-radio"></div>
    <div class="model-info">
      <div class="model-name">\${m.name}</div>
      <div class="model-desc">\${m.desc}</div>
    </div>
  \`;
  card.addEventListener('click', () => selectModel(m, card));
  grid.appendChild(card);
});

function selectModel(m, card) {
  document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  selectedModel = m;
  updateParamVisibility();
}

function updateParamVisibility() {
  const m = selectedModel;
  const stepsInput = document.getElementById('steps');
  const stepsLabel = document.getElementById('steps-label');
  stepsInput.min   = m.steps.min;
  stepsInput.max   = m.steps.max;
  stepsInput.value = m.steps.default;
  document.getElementById('steps-val').textContent = m.steps.default;
  stepsLabel.textContent = m.steps.locked ? '(fixed)' : '';
  stepsInput.disabled = m.steps.locked;

  document.getElementById('guidance-field').style.display = m.supportsGuidance ? '' : 'none';
  document.getElementById('neg-prompt').closest('.field').style.display = m.supportsNeg ? '' : 'none';
}

updateParamVisibility();

// ── Params toggle ──────────────────────────────────────────────────────────
function toggleParams() {
  const btn  = document.getElementById('params-toggle');
  const body = document.getElementById('params-body');
  btn.classList.toggle('open');
  body.classList.toggle('open');
}

// ── Generate ───────────────────────────────────────────────────────────────
async function generate() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) {
    document.getElementById('prompt').focus();
    return;
  }

  const btn = document.getElementById('generate-btn');
  const progressWrap = document.getElementById('progress');
  const progressLabel = document.getElementById('progress-label');
  const placeholder = document.getElementById('placeholder');
  const result = document.getElementById('result');
  const errorMsg = document.getElementById('error-msg');

  // UI: loading state
  btn.classList.add('loading');
  btn.disabled = true;
  placeholder.style.display = 'none';
  result.classList.remove('visible');
  errorMsg.classList.remove('visible');
  progressWrap.classList.add('visible');
  progressLabel.textContent = 'Generating with ' + selectedModel.name + '…';

  const body = {
    model:   selectedModel.id,
    prompt,
    steps:   parseInt(document.getElementById('steps').value),
    width:   parseInt(document.getElementById('width').value),
    height:  parseInt(document.getElementById('height').value),
  };

  if (selectedModel.supportsGuidance) {
    body.guidance = parseFloat(document.getElementById('guidance').value);
  }

  if (selectedModel.supportsNeg) {
    const neg = document.getElementById('neg-prompt').value.trim();
    if (neg) body.negative_prompt = neg;
  }

  try {
    const start = Date.now();
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const img = document.getElementById('output-img');
    img.src = url;
    img.onload = () => {
      progressWrap.classList.remove('visible');
      result.classList.add('visible');
    };

    document.getElementById('img-meta').textContent =
      selectedModel.name + '  ·  ' + body.width + '×' + body.height + '  ·  ' + elapsed + 's';

    const dl = document.getElementById('download-btn');
    dl.href = url;
    dl.download = 'imageforge-' + Date.now() + '.png';

  } catch (err) {
    progressWrap.classList.remove('visible');
    placeholder.style.display = '';
    errorMsg.textContent = '⚠ ' + (err.message || 'Generation failed. Try again.');
    errorMsg.classList.add('visible');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Allow Ctrl/Cmd+Enter to generate
document.getElementById('prompt').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});
</script>

</body>
</html>`;

// ── Worker ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the UI
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // Generation endpoint
    if (request.method === 'POST' && url.pathname === '/generate') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }

      const { model, prompt, steps, width, height, guidance, negative_prompt } = body;

      // Basic validation
      if (!prompt) return new Response('Prompt required', { status: 400 });

      const ALLOWED_MODELS = [
        '@cf/black-forest-labs/flux-1-schnell',
        '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        '@cf/lykon/dreamshaper-8-lcm',
      ];
      if (!ALLOWED_MODELS.includes(model)) {
        return new Response('Unknown model', { status: 400 });
      }

      const params = {
        prompt,
        num_steps: Math.min(Math.max(parseInt(steps) || 4, 1), 20),
        width:  Math.min(Math.max(parseInt(width)  || 512, 256), 768),
        height: Math.min(Math.max(parseInt(height) || 512, 256), 768),
      };

      if (guidance)         params.guidance        = parseFloat(guidance);
      if (negative_prompt)  params.negative_prompt = negative_prompt;

      try {
        const response = await env.AI.run(model, params);

        // Workers AI returns the image as a ReadableStream or ArrayBuffer
        let imageData: ArrayBuffer;

        if (response instanceof ReadableStream) {
          imageData = await new Response(response).arrayBuffer();
        } else if (response instanceof Response) {
          imageData = await response.arrayBuffer();
        } else {
          imageData = response as ArrayBuffer;
        }

        return new Response(imageData, {
          headers: { 'Content-Type': 'image/png' },
        });
      } catch (err) {
        console.error('AI error:', err);
        return new Response(
          err?.message || 'Image generation failed. You may have hit the free tier limit.',
          { status: 500 }
        );
      }
    }

    return new Response('Not found', { status: 404 });
  },
};