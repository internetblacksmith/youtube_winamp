// YouTube Winamp — Visualizer Editor
// Code textarea + live preview sandbox + save/load/delete + templates

(function () {
  "use strict";

  const codeEditor = document.getElementById("code-editor");
  const previewSandbox = document.getElementById("preview-sandbox");
  const previewContainer = document.getElementById("preview-container");
  const templateSelect = document.getElementById("template-select");
  const presetList = document.getElementById("preset-list");
  const presetName = document.getElementById("preset-name");
  const btnSave = document.getElementById("btn-save");
  const btnDelete = document.getElementById("btn-delete");
  const statusText = document.getElementById("status-text");

  let activePresetId = null;
  let debounceTimer = null;

  // ── Templates ───────────────────────────────────────────────────────
  const TEMPLATES = {
    spectrum: [
      "// Spectrum Bars — classic bar visualization",
      "ctx.fillStyle = colors[0] || '#000';",
      "ctx.fillRect(0, 0, w, h);",
      "",
      "var barW = Math.max(2, Math.floor(w / 24));",
      "var gap = Math.max(1, Math.floor(barW / 3));",
      "",
      "for (var i = 0; i < bars.length; i++) {",
      "  var bh = bars[i] * h;",
      "  var x = i * (barW + gap) + gap;",
      "",
      "  // Gradient from green to red",
      "  var grad = ctx.createLinearGradient(x, h, x, h - bh);",
      "  grad.addColorStop(0, colors[14] || '#39ad00');",
      "  grad.addColorStop(1, colors[2] || '#ef3110');",
      "  ctx.fillStyle = grad;",
      "  ctx.fillRect(x, h - bh, barW, bh);",
      "",
      "  // Peak dot",
      "  if (peaks[i] > 0.02) {",
      "    var py = h - peaks[i] * h;",
      "    ctx.fillStyle = colors[23] || '#ccc';",
      "    ctx.fillRect(x, py - 1, barW, 2);",
      "  }",
      "}"
    ].join("\n"),

    oscilloscope: [
      "// Oscilloscope — waveform line",
      "ctx.fillStyle = colors[0] || '#000';",
      "ctx.fillRect(0, 0, w, h);",
      "",
      "var midY = h / 2;",
      "ctx.strokeStyle = colors[18] || '#39ad00';",
      "ctx.lineWidth = 2;",
      "ctx.beginPath();",
      "",
      "for (var x = 0; x < w; x++) {",
      "  var y = 0;",
      "  for (var i = 0; i < bars.length; i++) {",
      "    var freq = 1 + i * 0.7;",
      "    y += bars[i] * 0.4 * Math.sin(t * freq * 3 + x * freq * 0.08);",
      "  }",
      "  var py = midY + y * h * 0.45;",
      "  if (x === 0) ctx.moveTo(x, py);",
      "  else ctx.lineTo(x, py);",
      "}",
      "ctx.stroke();"
    ].join("\n"),

    plasma: [
      "// Plasma — animated color effect",
      "var imgData = ctx.createImageData(w, h);",
      "var d = imgData.data;",
      "",
      "for (var y = 0; y < h; y++) {",
      "  for (var x = 0; x < w; x++) {",
      "    var v = Math.sin(x * 0.05 + t * 2)",
      "          + Math.sin(y * 0.05 + t * 1.5)",
      "          + Math.sin((x + y) * 0.03 + t)",
      "          + Math.sin(Math.sqrt(x * x + y * y) * 0.04);",
      "    v = (v + 4) / 8;",
      "",
      "    // Mix with bar energy for reactivity",
      "    var bi = Math.floor((x / w) * bars.length);",
      "    var energy = bars[Math.min(bi, bars.length - 1)] || 0;",
      "    v = v * (0.5 + energy * 0.5);",
      "",
      "    var idx = (y * w + x) * 4;",
      "    d[idx]     = Math.floor(128 + 127 * Math.sin(v * 6.28));",
      "    d[idx + 1] = Math.floor(128 + 127 * Math.sin(v * 6.28 + 2.09));",
      "    d[idx + 2] = Math.floor(128 + 127 * Math.sin(v * 6.28 + 4.19));",
      "    d[idx + 3] = 255;",
      "  }",
      "}",
      "ctx.putImageData(imgData, 0, 0);"
    ].join("\n"),

    starfield: [
      "// Starfield — particles from center",
      "ctx.fillStyle = 'rgba(0,0,0,0.15)';",
      "ctx.fillRect(0, 0, w, h);",
      "",
      "var cx = w / 2, cy = h / 2;",
      "var numStars = 60;",
      "",
      "// Use frame-seeded pseudo-random for consistent star positions",
      "function seeded(i) {",
      "  var s = Math.sin(i * 127.1 + frame * 0.001) * 43758.5453;",
      "  return s - Math.floor(s);",
      "}",
      "",
      "var avgEnergy = 0;",
      "for (var i = 0; i < bars.length; i++) avgEnergy += bars[i];",
      "avgEnergy /= bars.length;",
      "",
      "for (var i = 0; i < numStars; i++) {",
      "  var angle = seeded(i) * Math.PI * 2;",
      "  var speed = 0.5 + seeded(i + 100) * 2;",
      "  var life = ((t * speed + seeded(i + 200) * 10) % 5) / 5;",
      "  var dist = life * Math.max(w, h) * 0.7 * (0.5 + avgEnergy);",
      "  var sx = cx + Math.cos(angle) * dist;",
      "  var sy = cy + Math.sin(angle) * dist;",
      "  var size = 1 + life * 2;",
      "  var alpha = Math.min(1, life * 3) * (1 - life);",
      "",
      "  ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';",
      "  ctx.fillRect(sx - size/2, sy - size/2, size, size);",
      "}"
    ].join("\n")
  };

  // ── Simulated bar data for preview ──────────────────────────────────
  const NUM_BARS = 19;
  const simBars = new Float32Array(NUM_BARS);
  const simTargets = new Float32Array(NUM_BARS);
  const peakHeights = new Float32Array(NUM_BARS);
  const peakVelocity = new Float32Array(NUM_BARS);
  let simTick = 0;

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
    if (simTick % 6 === 0) {
      for (let i = 0; i < NUM_BARS; i++) {
        const bassBoost = Math.max(0, 1 - i / NUM_BARS);
        const base = 0.15 + bassBoost * 0.35;
        const beat = Math.random() < 0.12 ? 0.4 : 0;
        simTargets[i] = Math.min(1, base + Math.random() * 0.35 + beat);
      }
    }
    for (let i = 0; i < NUM_BARS; i++) {
      simBars[i] += (simTargets[i] - simBars[i]) * 0.18;
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
  function sendToSandbox(msg) {
    if (!previewSandbox.contentWindow) return;
    previewSandbox.contentWindow.postMessage(msg, "*");
  }

  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "READY") {
      statusText.textContent = "Script compiled OK";
      statusText.className = "success";
    } else if (e.data.type === "ERROR") {
      statusText.textContent = "Error: " + e.data.message;
      statusText.className = "error";
    }
  });

  // ── Preview render loop ─────────────────────────────────────────────
  let animFrame = null;

  function previewLoop() {
    updateSimBars();
    sendToSandbox({
      type: "RENDER_FRAME",
      bars: Array.from(simBars),
      peaks: Array.from(peakHeights),
      colors: visColors,
      playing: true
    });
    animFrame = requestAnimationFrame(previewLoop);
  }

  function sendResize() {
    const rect = previewContainer.getBoundingClientRect();
    sendToSandbox({
      type: "RESIZE",
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    });
  }

  window.addEventListener("resize", sendResize);

  // ── Code editing with debounced live preview ────────────────────────
  function applyCode() {
    const code = codeEditor.value;
    if (!code.trim()) {
      sendToSandbox({ type: "CLEAR" });
      statusText.textContent = "Empty";
      statusText.className = "";
      return;
    }
    statusText.textContent = "Compiling...";
    statusText.className = "";
    sendToSandbox({ type: "SET_SCRIPT", code: code });
  }

  codeEditor.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyCode, 300);
  });

  // Tab key inserts spaces instead of changing focus
  codeEditor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.substring(0, start) + "  " + codeEditor.value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyCode, 300);
    }
    // Ctrl/Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      savePreset();
    }
  });

  // ── Template selection ──────────────────────────────────────────────
  templateSelect.addEventListener("change", () => {
    const key = templateSelect.value;
    if (key && TEMPLATES[key]) {
      codeEditor.value = TEMPLATES[key];
      applyCode();
      // Suggest a name
      if (!presetName.value) {
        presetName.value = templateSelect.options[templateSelect.selectedIndex].text;
      }
    }
    templateSelect.value = "";
  });

  // ── Save / Load / Delete ────────────────────────────────────────────
  async function loadPresetList() {
    const presets = await window.VisStorage.list();
    presetList.innerHTML = '<option value="">-- Saved Presets --</option>';
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      presetList.appendChild(opt);
    }
    btnDelete.disabled = !activePresetId;
  }

  presetList.addEventListener("change", async () => {
    const id = presetList.value;
    if (!id) return;
    const vis = await window.VisStorage.getById(id);
    if (vis) {
      activePresetId = vis.id;
      presetName.value = vis.name;
      codeEditor.value = vis.code;
      applyCode();
      btnDelete.disabled = false;
    }
    presetList.value = "";
  });

  async function savePreset() {
    const name = presetName.value.trim();
    const code = codeEditor.value;
    if (!name) {
      statusText.textContent = "Enter a preset name first";
      statusText.className = "error";
      return;
    }
    if (!code.trim()) {
      statusText.textContent = "Nothing to save";
      statusText.className = "error";
      return;
    }
    try {
      const entry = await window.VisStorage.save(name, code, activePresetId);
      activePresetId = entry.id;
      await window.VisStorage.setActivePreset(entry.id);
      await loadPresetList();
      statusText.textContent = "Saved: " + name;
      statusText.className = "success";
      btnDelete.disabled = false;
    } catch (err) {
      statusText.textContent = "Save failed: " + err.message;
      statusText.className = "error";
    }
  }

  btnSave.addEventListener("click", savePreset);

  btnDelete.addEventListener("click", async () => {
    if (!activePresetId) return;
    const name = presetName.value;
    await window.VisStorage.delete(activePresetId);
    activePresetId = null;
    presetName.value = "";
    codeEditor.value = "";
    sendToSandbox({ type: "CLEAR" });
    await loadPresetList();
    statusText.textContent = "Deleted: " + name;
    statusText.className = "";
    btnDelete.disabled = true;
  });

  // ── Init ────────────────────────────────────────────────────────────
  async function init() {
    // Load vis colors
    try {
      const result = await chrome.storage.local.get("visColors");
      if (result.visColors) visColors = result.visColors;
    } catch {}

    // Load preset list
    await loadPresetList();

    // Load active preset if any
    try {
      const savedId = await window.VisStorage.getActivePreset();
      if (savedId) {
        const vis = await window.VisStorage.getById(savedId);
        if (vis) {
          activePresetId = vis.id;
          presetName.value = vis.name;
          codeEditor.value = vis.code;
        }
      }
    } catch {}

    // If no code loaded, start with spectrum template
    if (!codeEditor.value) {
      codeEditor.value = TEMPLATES.spectrum;
    }

    // Wait for sandbox iframe
    previewSandbox.addEventListener("load", () => {
      sendResize();
      applyCode();
      previewLoop();
    });
  }

  init();
})();
