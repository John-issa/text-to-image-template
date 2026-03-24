/**
 * Clean Text-to-Image Playground – Cloudflare Workers AI
 * Paste this entire file into src/index.ts and run `npx wrangler deploy`
 */

const MODELS = {
  'flux-schnell': { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell (Fast & Beautiful)', steps: 4, maxSteps: 8, guidance: false, negative: false },
  'flux-klein4': { id: '@cf/black-forest-labs/flux-2-klein-4b', name: 'FLUX.2 Klein 4B (Ultra Fast)', steps: 4, maxSteps: 8, guidance: false, negative: false },
  'flux-dev':   { id: '@cf/black-forest-labs/flux-2-dev', name: 'FLUX.2 Dev (Premium Realism)', steps: 20, maxSteps: 30, guidance: false, negative: false },
  'leonardo-lucid': { id: '@cf/leonardo/lucid-origin', name: 'Leonardo Lucid Origin (Photoreal)', steps: 20, maxSteps: 50, guidance: true, negative: true },
  'leonardo-phoenix': { id: '@cf/leonardo/phoenix-1.0', name: 'Leonardo Phoenix (Creative/Text)', steps: 20, maxSteps: 50, guidance: true, negative: true },
  'sdxl':       { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'Stable Diffusion XL (Classic)', steps: 20, maxSteps: 30, guidance: true, negative: true },
} as const;

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    if (url.pathname === '/generate' && request.method === 'POST') {
      const { prompt, negative, steps, guidance, modelKey, width = 1024, height = 1024 } = await request.json();
      const model = MODELS[modelKey as keyof typeof MODELS];
      if (!model) return new Response('Invalid model', { status: 400 });

      const inputs: any = { prompt, steps: parseInt(steps) };
      if (model.guidance) inputs.guidance_scale = parseFloat(guidance);
      if (model.negative && negative) inputs.negative_prompt = negative;
      inputs.width = parseInt(width);
      inputs.height = parseInt(height);

      const response = await env.AI.run(model.id, inputs);

      // FLUX returns base64, SDXL/Leonardo return stream
      if (response instanceof ReadableStream) {
        return new Response(response, { headers: { 'Content-Type': 'image/png' } });
      } else {
        return new Response(response, { headers: { 'Content-Type': 'image/png' } });
      }
    }

    // Serve clean UI
    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Forge • Clean</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@600&amp;display=swap');
    body { font-family: 'Inter', system_ui, sans-serif; }
    h1 { font-family: 'Space Grotesk', sans-serif; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen">
  <div class="max-w-5xl mx-auto p-6">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-semibold tracking-tight">Image Forge</h1>
      <a href="https://developers.cloudflare.com/workers-ai/" target="_blank" class="text-emerald-400 text-sm flex items-center gap-1 hover:underline">Powered by Workers AI <span class="text-xs">↗</span></a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Controls -->
      <div class="lg:col-span-5 bg-zinc-900 rounded-3xl p-8">
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-2">Prompt</label>
            <textarea id="prompt" rows="4" class="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 resize-none" placeholder="A serene mountain lake at golden hour..."></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-2">Model</label>
            <select id="model" class="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500">
              ${Object.keys(MODELS).map(k => `<option value="${k}">${MODELS[k as keyof typeof MODELS].name}</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-2">Steps</label>
              <input type="range" id="steps" min="1" max="50" value="20" class="w-full accent-emerald-500">
              <div id="stepsValue" class="text-right text-sm text-zinc-400">20</div>
            </div>
            <div id="guidanceContainer">
              <label class="block text-sm font-medium text-zinc-400 mb-2">Guidance</label>
              <input type="range" id="guidance" min="1" max="20" step="0.5" value="7.5" class="w-full accent-emerald-500">
              <div id="guidanceValue" class="text-right text-sm text-zinc-400">7.5</div>
            </div>
          </div>

          <div id="negativeContainer">
            <label class="block text-sm font-medium text-zinc-400 mb-2">Negative Prompt (optional)</label>
            <textarea id="negative" rows="2" class="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500" placeholder="blurry, low quality..."></textarea>
          </div>

          <button id="generateBtn" class="w-full bg-white text-black font-semibold py-4 rounded-2xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2">
            <span id="btnText">Generate Image</span>
          </button>
        </div>
      </div>

      <!-- Preview -->
      <div class="lg:col-span-7">
        <div class="bg-zinc-900 rounded-3xl overflow-hidden aspect-video flex items-center justify-center border border-zinc-800 relative">
          <img id="result" class="max-h-full w-auto hidden" alt="Generated image">
          <div id="placeholder" class="text-center text-zinc-500">
            <p class="text-2xl mb-2">✨</p>
            <p>Your image will appear here</p>
          </div>
          <div id="loading" class="hidden absolute inset-0 flex items-center justify-center bg-black/70">
            <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <a id="downloadBtn" class="hidden flex-1 text-center bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium">Download PNG</a>
          <button onclick="window.location.reload()" class="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium">New Image</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const tailwindScript = document.createElement('script');
    // Tailwind already loaded via CDN

    const promptEl = document.getElementById('prompt');
    const modelEl = document.getElementById('model');
    const stepsEl = document.getElementById('steps');
    const stepsValue = document.getElementById('stepsValue');
    const guidanceContainer = document.getElementById('guidanceContainer');
    const negativeContainer = document.getElementById('negativeContainer');
    const generateBtn = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');
    const resultImg = document.getElementById('result');
    const placeholder = document.getElementById('placeholder');
    const downloadBtn = document.getElementById('downloadBtn');

    // Live slider values
    stepsEl.addEventListener('input', () => stepsValue.textContent = stepsEl.value);

    // Model change → hide/show fields
    modelEl.addEventListener('change', updateUIForModel);
    function updateUIForModel() {
      const modelKey = modelEl.value;
      const model = ${JSON.stringify(MODELS)}[modelKey];
      guidanceContainer.style.display = model.guidance ? 'block' : 'none';
      negativeContainer.style.display = model.negative ? 'block' : 'none';
      stepsEl.max = model.maxSteps;
      stepsEl.value = model.steps;
      stepsValue.textContent = model.steps;
    }
    updateUIForModel();

    generateBtn.addEventListener('click', async () => {
      const prompt = promptEl.value.trim();
      if (!prompt) return alert("Please enter a prompt!");

      generateBtn.disabled = true;
      loading.classList.remove('hidden');
      placeholder.classList.add('hidden');
      resultImg.classList.add('hidden');

      try {
        const res = await fetch('/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative: document.getElementById('negative').value,
            steps: stepsEl.value,
            guidance: document.getElementById('guidance')?.value || 7.5,
            modelKey: modelEl.value
          })
        });

        if (!res.ok) throw new Error('Generation failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        resultImg.src = url;
        resultImg.classList.remove('hidden');
        downloadBtn.href = url;
        downloadBtn.download = 'generated-image.png';
        downloadBtn.classList.remove('hidden');
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        loading.classList.add('hidden');
        generateBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;