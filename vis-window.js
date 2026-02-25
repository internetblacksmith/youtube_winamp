// YouTube Winamp — Visualizer Window
// Self-contained: generates own simulated bar data, reads presets from storage

(function () {
  "use strict";

  const sandbox = document.getElementById("sandbox");
  const presetSelect = document.getElementById("preset-select");
  const btnEdit = document.getElementById("btn-edit");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const emptyState = document.getElementById("empty-state");
  const errorDisplay = document.getElementById("error-display");

  // ── Simulated bar data (same algorithm as winamp.js) ────────────────
  const NUM_BARS = 19;
  const simBars = new Float32Array(NUM_BARS);
  const simTargets = new Float32Array(NUM_BARS);
  const peakHeights = new Float32Array(NUM_BARS);
  const peakVelocity = new Float32Array(NUM_BARS);
  let simTick = 0;
  let playing = true; // assume playing since vis window is open for a reason

  // Default vis colors
  const defaultVisColors = [
    "rgb(0,0,0)",
    "rgb(24,33,41)", "rgb(239,49,16)", "rgb(206,41,16)", "rgb(214,90,0)",
    "rgb(214,102,0)", "rgb(214,115,0)", "rgb(198,123,0)", "rgb(181,131,0)",
    "rgb(165,139,0)", "rgb(148,148,0)", "rgb(107,156,0)", "rgb(74,165,0)",
    "rgb(57,173,0)", "rgb(57,173,0)", "rgb(57,173,0)", "rgb(57,173,0)",
    "rgb(57,173,0)", "rgb(57,173,0)",
    "rgb(9,202,0)", "rgb(9,202,0)", "rgb(9,202,0)", "rgb(9,202,0)",
    "rgb(200,200,200)"
  ];
  let visColors = defaultVisColors;

  function updateSimBars() {
    simTick++;
    if (simTick % 6 === 0 && playing) {
      for (let i = 0; i < NUM_BARS; i++) {
        const bassBoost = Math.max(0, 1 - i / NUM_BARS);
        const base = 0.15 + bassBoost * 0.35;
        const beat = Math.random() < 0.12 ? 0.4 : 0;
        simTargets[i] = Math.min(1, base + Math.random() * 0.35 + beat);
      }
    }
    for (let i = 0; i < NUM_BARS; i++) {
      if (playing) {
        simBars[i] += (simTargets[i] - simBars[i]) * 0.18;
      } else {
        simBars[i] *= 0.9;
      }
      if (simBars[i] > peakHeights[i]) {
        peakHeights[i] = simBars[i];
        peakVelocity[i] = 0;
      } else {
        peakVelocity[i] += 0.005;
        peakHeights[i] -= peakVelocity[i];
        if (peakHeights[i] < 0) peakHeights[i] = 0;
      }
    }
  }

  // ── Sandbox communication ───────────────────────────────────────────
  let sandboxReady = false;
  let activePresetId = null;
  let hasPresets = false;

  function sendToSandbox(msg) {
    if (!sandbox.contentWindow) return;
    sandbox.contentWindow.postMessage(msg, "*");
  }

  // Listen for sandbox messages
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "READY") {
      sandboxReady = true;
      errorDisplay.classList.add("hidden");
    } else if (e.data.type === "ERROR") {
      errorDisplay.textContent = e.data.message;
      errorDisplay.classList.remove("hidden");
    }
  });

  // ── Render loop ─────────────────────────────────────────────────────
  let animFrame = null;

  function renderLoop() {
    updateSimBars();
    sendToSandbox({
      type: "RENDER_FRAME",
      bars: Array.from(simBars),
      peaks: Array.from(peakHeights),
      colors: visColors,
      playing: playing
    });
    animFrame = requestAnimationFrame(renderLoop);
  }

  // ── Resize handling ─────────────────────────────────────────────────
  const canvasArea = document.getElementById("canvas-area");

  function sendResize() {
    const rect = canvasArea.getBoundingClientRect();
    sendToSandbox({
      type: "RESIZE",
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    });
  }

  window.addEventListener("resize", () => {
    sendResize();
  });

  // ── Preset management ──────────────────────────────────────────────
  async function loadPresetList() {
    const presets = await window.VisStorage.list();
    hasPresets = presets.length > 0;

    // Rebuild dropdown
    presetSelect.innerHTML = '<option value="">-- No Preset --</option>';
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      presetSelect.appendChild(opt);
    }

    // Restore active preset
    const savedId = await window.VisStorage.getActivePreset();
    if (savedId && presets.find(p => p.id === savedId)) {
      activePresetId = savedId;
      presetSelect.value = savedId;
    }

    updateEmptyState();
    if (activePresetId) loadPreset(activePresetId);
  }

  async function loadPreset(visId) {
    const vis = await window.VisStorage.getById(visId);
    if (!vis) {
      sendToSandbox({ type: "CLEAR" });
      return;
    }
    activePresetId = visId;
    emptyState.classList.add("hidden");
    errorDisplay.classList.add("hidden");
    sendToSandbox({ type: "SET_SCRIPT", code: vis.code });
  }

  function updateEmptyState() {
    if (!hasPresets && !activePresetId) {
      emptyState.classList.remove("hidden");
      // Show a default animated pattern when no presets exist
      sendToSandbox({
        type: "SET_SCRIPT",
        code: [
          "ctx.fillStyle = colors[0] || '#000';",
          "ctx.fillRect(0, 0, w, h);",
          "var barW = Math.max(2, Math.floor(w / 24));",
          "var gap = Math.max(1, Math.floor(barW / 3));",
          "for (var i = 0; i < bars.length; i++) {",
          "  var bh = bars[i] * h;",
          "  var x = i * (barW + gap) + gap;",
          "  var grad = ctx.createLinearGradient(x, h, x, h - bh);",
          "  grad.addColorStop(0, colors[14] || '#39ad00');",
          "  grad.addColorStop(1, colors[2] || '#ef3110');",
          "  ctx.fillStyle = grad;",
          "  ctx.fillRect(x, h - bh, barW, bh);",
          "  if (peaks[i] > 0.02) {",
          "    var py = h - peaks[i] * h;",
          "    ctx.fillStyle = colors[23] || '#ccc';",
          "    ctx.fillRect(x, py - 1, barW, 2);",
          "  }",
          "}"
        ].join("\n")
      });
    } else {
      emptyState.classList.add("hidden");
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────
  presetSelect.addEventListener("change", () => {
    const id = presetSelect.value;
    if (id) {
      loadPreset(id);
      window.VisStorage.setActivePreset(id);
    } else {
      activePresetId = null;
      window.VisStorage.setActivePreset(null);
      sendToSandbox({ type: "CLEAR" });
      updateEmptyState();
    }
  });

  btnEdit.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("vis-editor.html") });
  });

  btnFullscreen.addEventListener("click", () => {
    document.documentElement.requestFullscreen().catch(() => {});
  });

  // ── Listen for storage changes (new presets, color changes) ────────
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.visLibrary) {
      loadPresetList();
    }
    if (changes.visColors && changes.visColors.newValue) {
      visColors = changes.visColors.newValue;
    }
    if (changes.activeVisPreset && changes.activeVisPreset.newValue) {
      const newId = changes.activeVisPreset.newValue;
      if (newId !== activePresetId) {
        activePresetId = newId;
        presetSelect.value = newId;
        loadPreset(newId);
      }
    }
  });

  // ── Init ────────────────────────────────────────────────────────────
  async function init() {
    // Load vis colors from storage
    try {
      const result = await chrome.storage.local.get("visColors");
      if (result.visColors) visColors = result.visColors;
    } catch {}

    // Wait for sandbox iframe to load
    sandbox.addEventListener("load", () => {
      sendResize();
      loadPresetList();
      renderLoop();
    });
  }

  init();
})();
