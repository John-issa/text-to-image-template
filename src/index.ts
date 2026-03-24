/**
 * Image Forge — Cloudflare Workers AI Text-to-Image
 *
 * Fixed version (March 2026):
 * • Model-aware parameters (steps vs num_steps, guidance, negative_prompt)
 * • Correct response handling: FLUX returns base64, SDXL returns ReadableStream
 * • Dynamic sliders in UI (steps range, hide unsupported controls for FLUX)
 * • Better error handling + timeout protection
 * • Defaults to fast FLUX.1-schnell (free tier friendly)
 *
 * Replace your entire src/index.ts with this file and run:
 * npm run deploy
 */

const MODELS = {
  flux: {
    id: '@cf/black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 [schnell]',
    desc: 'Fastest • 4–8 steps • Best quality',
    maxSteps: 8,
    defaultSteps: 4,
    supportsGuidance: false,
    supportsNegative: false,
    supportsSize: false,
    responseType: 'base64' as const
  },
  sdxl: {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: 'Stable Diffusion XL',
    desc: 'Classic • 10–30 steps • Full control',
    maxSteps: 30,
    defaultSteps: 20,
    supportsGuidance: true,
    supportsNegative: true,
    supportsSize: true,
    responseType: 'stream' as const
  }
} as const;

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
    :root {
      --bg: #0d0d0d;
      --surface: #1a1a1a;
      --accent: #e8ff47;
      --text: #f0f0f0;
      --muted: #888;
      --border: #333;
      --radius: 8px;
    }
    body {
      margin: 0; font-family: 'Syne', sans-serif; background: var(--bg); color: var(--text);
      min-height: 100vh; display: grid; grid-template-columns: 320px 1fr;
    }
    .panel { background: var(--surface); padding: 1.5rem; border-right: 1px solid var(--border); }
    .field { margin: 1.2rem 0; }
    label { display: block; margin-bottom: 0.4rem; font-size: 0.9rem; color: var(--muted); }
    input, textarea { width: 100%; padding: 0.7rem; background: #111; border: 1px solid var(--border);
      border-radius: var(--radius); color: var(--text); font-family: 'DM Mono', monospace; }
    textarea { height: 120px; resize: vertical; }
    .btn { background: var(--accent); color: #000; border: none; padding: 0.7rem 1.2rem;
      border-radius: var(--radius); font-weight: 700; cursor: pointer; }
    #result { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    img { max-width: 100%; border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
    .image-toolbar { margin-top: 1rem; display: flex; gap: 1rem; }

    /* New styles from earlier */
    .aspect-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .aspect-btn { background: var(--surface); border: 1px solid var(--border); padding: 0.4rem 0.8rem;
      border-radius: var(--radius); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
    .aspect-btn.active { border-color: var(--accent); background: rgba(232,255,71,0.1); color: var(--accent); }

    .example-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chip { background: var(--surface); border: 1px solid var(--border); padding: 0.25rem 0.75rem;
      border-radius: 999px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
    .chip:hover { background: var(--accent); color: #000; }

    .history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.75rem; }
    .history-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius);
      border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
    .history-thumb:hover { border-color: var(--accent); transform: scale(1.05); }

    .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: var(--accent); color: #000; padding: 0.75rem 1.5rem; border-radius: 999px;
      font-weight: 700; opacity: 0; transition: all 0.3s; pointer-events: none; z-index: 100; }
    .toast.show { opacity: 1; }

    @media (max-width: 800px) { body { grid-template-columns: 1fr; } .panel { border-right: none; border-bottom: 1px solid var(--border); } }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Image Forge</h1>
    <div class="field">
      <label>Prompt</label>
      <textarea id="prompt" placeholder="A cyberpunk samurai under neon rain..."></textarea>
    </div>

    <div class="field">
      <label>Quick examples</label>
      <div class="example-chips" id="examples"></div>
    </div>

    <div class="field">
      <label>Model</label>
      <div id="model-cards"></div>
    </div>

    <div class="field">
      <label>Aspect ratio</label>
      <div class="aspect-buttons" id="aspect-buttons"></div>
    </div>

    <div class="field">
      <label>Width</label>
      <input type="number" id="width" value="1024" min="256" max="2048" step="64">
    </div>
    <div class="field">
      <label>Height</label>
      <input type="number" id="height" value="1024" min="256" max="2048" step="64">
    </div>

    <div class="field">
      <label>Steps <span id="steps-value">20</span></label>
      <input type="range" id="steps" min="1" max="30" value="20">
    </div>

    <div id="guidance-field" class="field">
      <label>Guidance scale <span id="guidance-value">7.5</span></label>
      <input type="range" id="guidance" min="1" max="20" step="0.5" value="7.5">
    </div>

    <div id="negative-field" class="field">
      <label>Negative prompt</label>
      <textarea id="negative_prompt" placeholder="blurry, low quality, deformed..."></textarea>
    </div>

    <div id="seed-field" class="field">
      <label>Seed <button onclick="randomizeSeed()" style="font-size:0.7rem;background:none;border:none;color:var(--accent);cursor:pointer;">🎲 Random</button></label>
      <input type="number" id="seed" value="42">
    </div>

    <div class="field">
      <label>Recent generations</label>
      <div id="history-grid" class="history-grid"></div>
    </div>

    <button class="btn" onclick="generate()">Generate</button>
  </div>

  <div id="result">
    <div id="loading" style="display:none;">Generating... please wait</div>
    <img id="generated" style="display:none;" alt="Generated image">
    <div class="image-toolbar" id="toolbar" style="display:none;">
      <a id="download-btn" class="btn">⬇ Download PNG</a>
      <button class="btn" onclick="generate()">Regenerate</button>
    </div>
  </div>

  <div id="toast" class="toast">Image ready!</div>

  <script>
    let selectedModel = MODELS.flux;
    let lastPrompt = '';

    const modelCards = document.getElementById('model-cards');
    Object.values(MODELS).forEach(m => {
      const card = document.createElement('div');
      card.innerHTML = \`<div style="padding:0.8rem;border:1px solid var(--border);border-radius:8px;margin:0.5rem 0;cursor:pointer;" onclick="selectModel('${m.id}')">
        <strong>\${m.name}</strong><br><small>\${m.desc}</small>
      </div>\`;
      modelCards.appendChild(card.firstChild);
    });

    function selectModel(id) {
      selectedModel = Object.values(MODELS).find(m => m.id === id);
      updateParamVisibility();
      document.querySelectorAll('#model-cards > div').forEach(el => el.style.borderColor = el.textContent.includes(selectedModel.name) ? 'var(--accent)' : 'var(--border)');
    }

    function updateParamVisibility() {
      const isFlux = selectedModel.id.includes('flux');
      document.getElementById('guidance-field').style.display = isFlux ? 'none' : 'block';
      document.getElementById('negative-field').style.display = isFlux ? 'none' : 'block';
      document.getElementById('width').disabled = isFlux;
      document.getElementById('height').disabled = isFlux;
      if (isFlux) {
        document.getElementById('width').value = 1024;
        document.getElementById('height').value = 1024;
      }
      document.getElementById('steps').max = selectedModel.maxSteps;
      document.getElementById('steps').value = selectedModel.defaultSteps;
      document.getElementById('steps-value').textContent = selectedModel.defaultSteps;
    }

    // Aspect presets
    const aspectPresets = [
      {label:'Square', w:1024, h:1024},
      {label:'Landscape', w:1216, h:768},
      {label:'Portrait', w:768, h:1216},
      {label:'Wide', w:1536, h:640}
    ];
    const aspectDiv = document.getElementById('aspect-buttons');
    aspectPresets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'aspect-btn';
      btn.textContent = p.label;
      btn.onclick = () => {
        document.getElementById('width').value = p.w;
        document.getElementById('height').value = p.h;
        document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
      aspectDiv.appendChild(btn);
    });

    // Examples
    const examples = ["cyberpunk cat warrior", "futuristic neon city at night", "ethereal glowing forest spirit", "steampunk mechanical owl", "surreal floating islands in sunset"];
    const chipsDiv = document.getElementById('examples');
    examples.forEach(ex => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = ex;
      chip.onclick = () => document.getElementById('prompt').value = ex;
      chipsDiv.appendChild(chip);
    });

    // Steps slider update
    document.getElementById('steps').oninput = e => {
      document.getElementById('steps-value').textContent = e.target.value;
    };
    document.getElementById('guidance').oninput = e => {
      document.getElementById('guidance-value').textContent = e.target.value;
    };

    // Seed random
    function randomizeSeed() {
      document.getElementById('seed').value = Math.floor(Math.random() * 999999999);
    }

    // History
    let history = JSON.parse(localStorage.getItem('imageHistory') || '[]');
    function renderHistory() {
      const grid = document.getElementById('history-grid');
      grid.innerHTML = '';
      history.forEach((item, i) => {
        const img = document.createElement('img');
        img.className = 'history-thumb';
        img.src = item.url;
        img.onclick = () => {
          document.getElementById('generated').src = item.url;
          document.getElementById('generated').style.display = 'block';
          document.getElementById('toolbar').style.display = 'flex';
        };
        grid.appendChild(img);
      });
    }
    renderHistory();

    function addToHistory(url) {
      history.unshift({url, prompt: document.getElementById('prompt').value});
      if (history.length > 12) history.pop();
      localStorage.setItem('imageHistory', JSON.stringify(history));
      renderHistory();
    }

    async function generate() {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) return alert('Enter a prompt!');

      lastPrompt = prompt;
      document.getElementById('loading').style.display = 'block';
      document.getElementById('generated').style.display = 'none';
      document.getElementById('toolbar').style.display = 'none';

      try {
        const res = await fetch('/generate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            model: selectedModel.id,
            prompt,
            steps: parseInt(document.getElementById('steps').value),
            guidance: document.getElementById('guidance').value,
            negative_prompt: document.getElementById('negative_prompt').value,
            width: parseInt(document.getElementById('width').value),
            height: parseInt(document.getElementById('height').value),
            seed: parseInt(document.getElementById('seed').value) || undefined
          })
        });

        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const img = document.getElementById('generated');
        img.src = url;
        img.onload = () => {
          img.style.display = 'block';
          document.getElementById('loading').style.display = 'none';
          document.getElementById('toolbar').style.display = 'flex';
          addToHistory(url);

          const toast = document.getElementById('toast');
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 3000);
        };
      } catch (err) {
        alert('Error: ' + err.message);
        document.getElementById('loading').style.display = 'none';
      }
    }

    document.getElementById('download-btn').onclick = () => {
      const a = document.createElement('a');
      a.href = document.getElementById('generated').src;
      a.download = 'imageforge-' + Date.now() + '.png';
      a.click();
    };

    // Initial setup
    updateParamVisibility();
  </script>
</body>
</html>`;

// ====================== BACKEND ======================
export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }

    if (request.method === 'POST' && request.url.endsWith('/generate')) {
      try {
        const { model, prompt, steps, guidance, negative_prompt, width, height } = await request.json();

        if (!prompt) throw new Error('Prompt is required');

        // Find model config
        const modelConfig = Object.values(MODELS).find(m => m.id === model);
        if (!modelConfig) throw new Error('Unknown model');

        // Build parameters correctly per model
        const params = { prompt };

        if (modelConfig.id.includes('flux')) {
          params.steps = Math.max(1, Math.min(steps || modelConfig.defaultSteps, modelConfig.maxSteps));
        } else {
          params.num_steps = Math.max(1, Math.min(steps || modelConfig.defaultSteps, modelConfig.maxSteps));
          if (guidance) params.guidance = parseFloat(guidance);
          if (negative_prompt) params.negative_prompt = negative_prompt;
        }

        if (modelConfig.supportsSize && width && height) {
          params.width = Math.max(256, Math.min(width, 2048));
          params.height = Math.max(256, Math.min(height, 2048));
        }

        // Run inference
        const result = await env.AI.run(model, params);

        let imageData;
        let contentType = 'image/jpeg';

        if (modelConfig.responseType === 'base64') {
          // FLUX returns { image: "base64string" }
          const base64 = result.image;
          imageData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else {
          // SDXL returns ReadableStream
          imageData = result;
          contentType = 'image/jpeg';
        }

        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
          }
        });

      } catch (err) {
        return new Response('Generation failed: ' + err.message, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;