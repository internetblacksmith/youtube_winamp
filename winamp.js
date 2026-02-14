// YouTube Winamp — UI Controller
// Polling model: requests state every 500ms from service worker
// DOM IDs match the Winamp 2.x layout, skin sprites applied by skin-loader.js

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────
  let currentState = {
    connected: false,
    state: "stopped",
    currentTime: 0,
    duration: 0,
    volume: 50,
    title: "",
    artist: "",
    shuffle: false,
    repeat: "off",
    kbps: 0,
    khz: 0
  };

  let currentService = null; // "youtube" | "spotify" | "amazon"
  let showRemaining = false;
  let isSeeking = false;
  let isVolumeChanging = false;
  let pollTimer = null;
  let marqueeOffset = 0;
  let marqueeText = "";
  let marqueeFrame = null;
  let lastTrackKey = "";

  // EQ state
  let eqVisible = false;

  // Playlist state
  let playlistVisible = false;
  let playlistTracks = [];
  let playlistCurrentIndex = -1;
  let playlistSelectedIndex = -1;
  let playlistScrollOffset = 0;
  let isDraggingScrollbar = false;

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const winamp         = $("#winamp");
  const playPause      = $("#play-pause");
  const minusSign      = $("#minus-sign");
  const digitM1        = $("#minute-first-digit");
  const digitM2        = $("#minute-second-digit");
  const digitS1        = $("#second-first-digit");
  const digitS2        = $("#second-second-digit");
  const timeEl         = $("#time");
  const marqueeCanvas  = $("#marquee-canvas");
  const marqueeCtx     = marqueeCanvas ? marqueeCanvas.getContext("2d") : null;
  const seekSlider     = $("#seek-slider");
  const volumeSlider   = $("#volume-slider");
  const volumeEl       = $("#volume");
  const balanceEl      = $("#balance");
  const btnPlay        = $("#btn-play");
  const btnPause       = $("#btn-pause");
  const btnStop        = $("#btn-stop");
  const btnPrev        = $("#btn-prev");
  const btnNext        = $("#btn-next");
  const btnEject       = $("#btn-eject");
  const btnShuffle     = $("#btn-shuffle");
  const btnRepeat      = $("#btn-repeat");
  const btnMinimize    = $("#btn-minimize");
  const btnClose       = $("#btn-close");
  const kbpsCanvas     = $("#kbps");
  const kbpsCtx        = kbpsCanvas ? kbpsCanvas.getContext("2d") : null;
  const khzCanvas      = $("#khz");
  const khzCtx         = khzCanvas ? khzCanvas.getContext("2d") : null;
  const visCanvas      = $("#visualizer");
  const visCtx         = visCanvas ? visCanvas.getContext("2d") : null;
  const skinFileInput  = $("#skin-file-input");
  const btnEq          = $("#btn-eq");
  const eqWindow       = $("#eq-window");
  const eqBtnClose     = $("#eq-btn-close");
  const eqBtnOn        = $("#eq-btn-on");
  const eqBtnAuto      = $("#eq-btn-auto");
  const btnPl          = $("#btn-pl");
  const playlistWindow = $("#playlist-window");
  const plTrackList    = $("#pl-track-list");
  const plScrollHandle = $("#pl-scroll-handle");
  const plScrollbar    = $("#pl-scrollbar");
  const plBtnClose     = $("#pl-btn-close");

  // ── Messaging ──────────────────────────────────────────────────────────
  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          resolve(chrome.runtime.lastError ? null : r);
        });
      } catch { resolve(null); }
    });
  }
  function sendCommand(cmd, val) {
    return sendMessage({ type: "COMMAND", command: cmd, value: val });
  }

  // ── Polling ────────────────────────────────────────────────────────────
  async function pollState() {
    const r = await sendMessage({ type: "GET_STATE" });
    if (!r || !r.connected) {
      currentState.connected = false;
    } else {
      currentService = r.service || null;
      Object.assign(currentState, r);
    }
    updateUI();

    // Poll queue when playlist is visible
    if (playlistVisible) {
      const q = await sendMessage({ type: "GET_QUEUE" });
      if (q && q.tracks) {
        updatePlaylist(q.tracks, q.currentIndex);
      }
    }
  }
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollState();
    pollTimer = setInterval(pollState, 500);
  }

  // ── UI Update ──────────────────────────────────────────────────────────
  function updateUI() {
    // Connection
    winamp.classList.toggle("disconnected", !currentState.connected);

    // Status class on root
    winamp.classList.remove("playing", "paused", "stopped");
    winamp.classList.add(currentState.state || "stopped");

    // Play/Pause indicator
    playPause.className = currentState.state || "stopped";

    // Time
    updateTime();

    // Marquee
    updateMarquee();

    // Seek
    if (!isSeeking) {
      seekSlider.value = currentState.duration > 0
        ? (currentState.currentTime / currentState.duration) * 1000
        : 0;
    }

    // Volume — update background position (28 frames, each 13px tall)
    if (!isVolumeChanging) {
      volumeSlider.value = currentState.volume;
    }
    updateVolumeBackground();

    // Toggles
    btnShuffle.classList.toggle("active", currentState.shuffle);
    btnRepeat.classList.toggle("active", currentState.repeat !== "off");

    // Balance — always centered (frame 14 of 28)
    updateBalanceBackground();

    // kbps / khz — always draw (bridge defaults to 128/44)
    drawSmallText(kbpsCtx, kbpsCanvas, String(currentState.kbps || 0).padStart(3, " "));
    drawSmallText(khzCtx, khzCanvas, String(currentState.khz || 0).padStart(2, " "));
  }

  function updateVolumeBackground() {
    // Volume.bmp has 28 frames stacked vertically (68×420 total, 15px per frame)
    // Frame 0 = silent, Frame 27 = max volume
    const vol = parseInt(volumeSlider.value, 10);
    const frame = Math.round((vol / 100) * 27);
    const yOffset = frame * 15;
    volumeEl.style.backgroundPosition = `0 -${yOffset}px`;
  }

  function updateBalanceBackground() {
    // Balance.bmp has 28 frames stacked vertically (38×420 total, 15px per frame)
    // Frame 14 = center
    const bal = parseInt(document.getElementById("balance-slider").value, 10);
    const frame = Math.round(((bal + 100) / 200) * 27);
    const yOffset = frame * 15;
    balanceEl.style.backgroundPosition = `0 -${yOffset}px`;
  }

  function updateTime() {
    let secs;
    if (showRemaining && currentState.duration > 0) {
      secs = Math.max(0, currentState.duration - currentState.currentTime);
      minusSign.className = "visible";
    } else {
      secs = currentState.currentTime;
      minusSign.className = "hidden";
    }
    secs = Math.floor(secs);
    const m = String(Math.min(Math.floor(secs / 60), 99)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");

    setDigit(digitM1, m[0]);
    setDigit(digitM2, m[1]);
    setDigit(digitS1, s[0]);
    setDigit(digitS2, s[1]);
  }

  function setDigit(el, d) {
    // Remove all digit-N classes, add the right one
    el.className = "digit digit-" + d;
  }

  // ── Small text rendering (kbps, khz) using TEXT.BMP sprites ──────────
  // Track last drawn text to avoid redundant redraws
  const lastSmallText = new Map();

  function drawSmallText(ctx, canvas, text) {
    if (!ctx) return;
    // Skip redraw if text hasn't changed
    if (lastSmallText.get(canvas) === text) return;

    const CHAR_W = 5;
    const chars = window._skinCharacters || {};
    if (!Object.keys(chars).length) return; // skin not loaded yet

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allReady = true;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i].toLowerCase();
      const src = chars[ch] || chars[" "];
      if (!src) continue;

      let img = charImageCache[ch];
      if (!img) {
        img = loadCharImage(ch, src);
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, i * CHAR_W, 0, CHAR_W, canvas.height);
      } else {
        allReady = false;
      }
    }

    if (allReady) {
      lastSmallText.set(canvas, text);
    } else {
      // Retry once images have decoded
      setTimeout(() => {
        lastSmallText.delete(canvas); // force redraw
        drawSmallText(ctx, canvas, text);
      }, 100);
    }
  }

  // ── Marquee (character sprite rendering) ──────────────────────────────
  function updateMarquee() {
    const key = currentState.title + "|" + currentState.artist;
    if (key === lastTrackKey) return;
    lastTrackKey = key;

    if (currentState.title && currentState.artist) {
      marqueeText = (currentState.title + "  -  " + currentState.artist).toUpperCase();
    } else if (currentState.title) {
      marqueeText = currentState.title.toUpperCase();
    } else if (!currentState.connected) {
      marqueeText = "WINAMP";
    } else {
      marqueeText = "NO TRACK PLAYING";
    }

    marqueeOffset = 0;
    if (!marqueeFrame) startMarquee();
  }

  function startMarquee() {
    const CHAR_W = window.SkinLoader ? window.SkinLoader.CHAR_W : 5;
    const chars = window._skinCharacters || {};
    const hasChars = Object.keys(chars).length > 0;

    function drawMarquee() {
      if (!marqueeCtx) { marqueeFrame = null; return; }

      const canvasW = marqueeCanvas.width;
      const canvasH = marqueeCanvas.height;
      marqueeCtx.clearRect(0, 0, canvasW, canvasH);

      if (!hasChars || !marqueeText) {
        // Fallback: simple text rendering
        marqueeCtx.fillStyle = "#00ff00";
        marqueeCtx.font = "5px monospace";
        marqueeCtx.fillText(marqueeText || "", 2, 5);
        marqueeFrame = requestAnimationFrame(drawMarquee);
        return;
      }

      // Calculate total text width
      const sep = "   ***   ";
      const fullText = marqueeText + sep;
      const totalW = fullText.length * CHAR_W;

      // Determine if scrolling needed (text wider than canvas)
      const needsScroll = totalW > canvasW;

      if (needsScroll) {
        // Draw two copies for seamless loop
        for (let copy = 0; copy < 2; copy++) {
          const baseX = copy * totalW - marqueeOffset;
          for (let i = 0; i < fullText.length; i++) {
            const ch = fullText[i].toLowerCase();
            const sprite = chars[ch] || chars[" "];
            if (sprite) {
              const img = charImageCache[ch] || loadCharImage(ch, sprite);
              if (img && img.complete) {
                marqueeCtx.drawImage(img, baseX + i * CHAR_W, 0, CHAR_W, canvasH);
              }
            }
          }
        }
        marqueeOffset = (marqueeOffset + 0.5) % totalW;
      } else {
        // Static — draw once, centered or left-aligned
        for (let i = 0; i < marqueeText.length; i++) {
          const ch = marqueeText[i].toLowerCase();
          const sprite = chars[ch] || chars[" "];
          if (sprite) {
            const img = charImageCache[ch] || loadCharImage(ch, sprite);
            if (img && img.complete) {
              marqueeCtx.drawImage(img, i * CHAR_W, 0, CHAR_W, canvasH);
            }
          }
        }
      }

      marqueeFrame = requestAnimationFrame(drawMarquee);
    }

    drawMarquee();
  }

  // Character image cache
  const charImageCache = {};
  function loadCharImage(ch, src) {
    const img = new Image();
    img.src = src;
    charImageCache[ch] = img;
    return img;
  }

  // ── Spectrum Analyser ─────────────────────────────────────────────────
  let visFrame = null;
  const NUM_BARS = 19;
  const peakHeights = new Float32Array(NUM_BARS);
  const peakVelocity = new Float32Array(NUM_BARS);

  // Simulated bar state — smooth, organic-looking motion
  const simBars = new Float32Array(NUM_BARS);
  const simTargets = new Float32Array(NUM_BARS);
  let simTick = 0;

  // Default vis colors (overridden by skin's VISCOLOR.TXT)
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

  function getVisColors() {
    return window._skinVisColors || defaultVisColors;
  }

  function drawVis() {
    if (!visCtx) return;
    const w = visCanvas.width;
    const h = visCanvas.height;
    const colors = getVisColors();
    const isPlaying = currentState.state === "playing";

    // Background
    visCtx.fillStyle = colors[0] || "rgb(0,0,0)";
    visCtx.fillRect(0, 0, w, h);

    const barW = 3;
    const gap = 1;

    // Update simulated targets every ~6 frames for natural rhythm
    simTick++;
    if (simTick % 6 === 0 && isPlaying) {
      for (let i = 0; i < NUM_BARS; i++) {
        // Bass bars (left) tend higher, treble (right) tend lower
        const bassBoost = Math.max(0, 1 - i / NUM_BARS);
        const base = 0.15 + bassBoost * 0.35;
        // Add randomness with occasional "beats" (high spikes)
        const beat = Math.random() < 0.12 ? 0.4 : 0;
        simTargets[i] = Math.min(1, base + Math.random() * 0.35 + beat);
      }
    }

    for (let i = 0; i < NUM_BARS; i++) {
      let barVal;
      if (isPlaying) {
        // Smooth interpolation toward target
        simBars[i] += (simTargets[i] - simBars[i]) * 0.18;
        barVal = simBars[i];
      } else {
        // Decay to zero when not playing
        simBars[i] *= 0.9;
        barVal = simBars[i];
      }

      // Bar height
      const bh = barVal * h;
      const x = i * (barW + gap);
      const numSegs = Math.ceil(bh / 2);

      for (let s = 0; s < numSegs; s++) {
        const sy = h - (s + 1) * 2;
        const colorIdx = Math.min(2 + Math.floor((s / (h / 2)) * 16), 17);
        visCtx.fillStyle = colors[colorIdx] || "rgb(0,200,0)";
        visCtx.fillRect(x, sy, barW, 1);
      }

      // Falling peak dot
      if (barVal > peakHeights[i]) {
        peakHeights[i] = barVal;
        peakVelocity[i] = 0;
      } else {
        peakVelocity[i] += 0.005;
        peakHeights[i] -= peakVelocity[i];
        if (peakHeights[i] < 0) peakHeights[i] = 0;
      }

      if (peakHeights[i] > 0.02) {
        const peakY = h - Math.floor(peakHeights[i] * h) - 1;
        visCtx.fillStyle = colors[23] || "rgb(200,200,200)";
        visCtx.fillRect(x, Math.max(0, peakY), barW, 1);
      }
    }

    visFrame = requestAnimationFrame(drawVis);
  }

  function startVis() {
    if (!visFrame) drawVis();
  }
  function stopVis() { if (visFrame) { cancelAnimationFrame(visFrame); visFrame = null; } }

  // ── Window sizing ────────────────────────────────────────────────
  let expectedContentW = 275;
  let expectedContentH = 116;

  function resizeWindowToContent(contentW, contentH) {
    expectedContentW = contentW;
    expectedContentH = contentH;
    chrome.windows.getCurrent((w) => {
      if (!w) return;
      const chromeW = w.width - window.innerWidth;
      const chromeH = w.height - window.innerHeight;
      chrome.windows.update(w.id, {
        width: contentW + chromeW,
        height: contentH + chromeH
      });
    });
  }

  // Prevent manual resizing — snap back to correct size
  window.addEventListener("resize", () => {
    if (window.innerWidth !== expectedContentW || window.innerHeight !== expectedContentH) {
      resizeWindowToContent(expectedContentW, expectedContentH);
    }
  });

  // ── EQ Window ────────────────────────────────────────────────────
  const EQ_HEIGHT = 116;

  function getContentHeight() {
    return 116 + (eqVisible ? EQ_HEIGHT : 0) + (playlistVisible ? PL_HEIGHT : 0);
  }

  function toggleEQ() {
    eqVisible = !eqVisible;
    eqWindow.classList.toggle("hidden", !eqVisible);
    btnEq.classList.toggle("active", eqVisible);
    resizeWindowToContent(275, getContentHeight());
  }

  // EQ graph canvas
  const eqGraphCanvas = $("#eq-graph-canvas");
  const eqGraphCtx = eqGraphCanvas ? eqGraphCanvas.getContext("2d") : null;

  // Default wave shape — classic "smiley" EQ with some character
  // Values are top-offsets within 0–52 range (0=boost, 26=center, 52=cut)
  const EQ_DEFAULT_POSITIONS = [10, 16, 22, 30, 34, 32, 26, 18, 12, 8];

  function drawEQGraph() {
    if (!eqGraphCtx) return;
    const w = eqGraphCanvas.width;   // 113
    const h = eqGraphCanvas.height;  // 19
    eqGraphCtx.clearRect(0, 0, w, h);

    // Collect slider values: 0 = top (boost), 1 = bottom (cut)
    const thumbs = document.querySelectorAll("#eq-sliders .eq-slider-thumb");
    const values = [];
    const trackH = 63;
    const thumbH = 11;
    const maxTop = trackH - thumbH;

    thumbs.forEach((thumb) => {
      const top = parseFloat(thumb.style.top);
      values.push((isNaN(top) ? 26 : top) / maxTop);
    });

    // Map 10 band values to x positions across graph width
    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * w,
      y: 2 + v * (h - 4) // 2px padding top/bottom
    }));

    // Use skin vis colors for the line (index 18 = bright green bar color)
    const colors = getVisColors();
    eqGraphCtx.strokeStyle = colors[18] || colors[14] || "#00ff00";
    eqGraphCtx.lineWidth = 1;
    eqGraphCtx.beginPath();

    if (points.length > 1) {
      eqGraphCtx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cp1x = (points[i].x + points[i + 1].x) / 2;
        const cp1y = points[i].y;
        const cp2x = cp1x;
        const cp2y = points[i + 1].y;
        eqGraphCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
      }
    }

    eqGraphCtx.stroke();
  }

  // EQ slider bar background — 28 frames in a 14×2 grid (each 15×65)
  // Frame 0 = max cut, frame 14 = center, frame 27 = max boost
  const EQ_TRACK_H = 63;
  const EQ_THUMB_H = 11;
  const EQ_MAX_TOP = EQ_TRACK_H - EQ_THUMB_H; // 52

  function updateSliderBg(thumb) {
    const track = thumb.parentElement;
    const bgUri = window._eqSliderBg;
    if (!bgUri) return;

    const top = parseFloat(thumb.style.top) || 26;
    // top 0 = max boost (frame 27), top 52 = max cut (frame 0)
    const frame = Math.round((1 - top / EQ_MAX_TOP) * 27);
    const col = frame % 14;
    const row = Math.floor(frame / 14);

    track.style.backgroundImage = `url("${bgUri}")`;
    track.style.backgroundSize = "209px 129px";
    track.style.backgroundPosition = `-${col * 15}px -${row * 65}px`;
  }

  function applyAllSliderBgs() {
    document.querySelectorAll(".eq-slider-thumb").forEach(updateSliderBg);
  }

  // EQ slider thumb dragging
  function initEQSliders() {
    // Set default wave positions on the 10 band sliders
    const bandThumbs = document.querySelectorAll("#eq-sliders .eq-slider-thumb");
    bandThumbs.forEach((thumb, i) => {
      thumb.style.top = (EQ_DEFAULT_POSITIONS[i] || 26) + "px";
    });

    // Apply initial slider bar backgrounds
    applyAllSliderBgs();

    // Drag behavior for all thumbs (preamp + bands)
    const allThumbs = document.querySelectorAll(".eq-slider-thumb");
    allThumbs.forEach((thumb) => {
      thumb.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const track = thumb.parentElement;
        const trackRect = track.getBoundingClientRect();
        thumb.classList.add("active");

        function onMove(ev) {
          const y = ev.clientY - trackRect.top - EQ_THUMB_H / 2;
          thumb.style.top = Math.max(0, Math.min(EQ_MAX_TOP, y)) + "px";
          updateSliderBg(thumb);
          drawEQGraph();
        }
        function onUp() {
          thumb.classList.remove("active");
          // Snap back: band sliders to default wave, preamp to center
          const band = thumb.dataset.band;
          const idx = parseInt(band, 10);
          thumb.style.top = (!isNaN(idx) && EQ_DEFAULT_POSITIONS[idx] != null
            ? EQ_DEFAULT_POSITIONS[idx] : 26) + "px";
          updateSliderBg(thumb);
          drawEQGraph();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });

    // Draw initial graph with wave positions
    drawEQGraph();
  }

  // ── Playlist Editor ───────────────────────────────────────────────
  const PL_TRACK_HEIGHT = 13;
  const PL_HEIGHT = 174;        // 20 + 116 + 38

  function getVisibleTrackCount() {
    return Math.floor(plTrackList.clientHeight / PL_TRACK_HEIGHT);
  }

  function togglePlaylist() {
    playlistVisible = !playlistVisible;
    playlistWindow.classList.toggle("hidden", !playlistVisible);
    btnPl.classList.toggle("active", playlistVisible);

    // Resize window to fit content
    resizeWindowToContent(275, getContentHeight());

    if (playlistVisible) {
      // Trigger immediate queue fetch, scroll to current track
      sendMessage({ type: "GET_QUEUE" }).then((q) => {
        if (q && q.tracks) {
          playlistTracks = q.tracks;
          playlistCurrentIndex = q.currentIndex;
          scrollToCurrentTrack();
          renderPlaylist();
        }
      });
    }
  }

  function scrollToCurrentTrack() {
    if (playlistCurrentIndex < 0) return;
    const visCount = getVisibleTrackCount() || 8;
    // Only scroll if current track is outside visible range
    if (playlistCurrentIndex < playlistScrollOffset ||
        playlistCurrentIndex >= playlistScrollOffset + visCount) {
      playlistScrollOffset = playlistCurrentIndex;
    }
  }

  function updatePlaylist(tracks, currentIndex) {
    const trackChanged = currentIndex !== playlistCurrentIndex;
    playlistTracks = tracks;
    playlistCurrentIndex = currentIndex;
    if (trackChanged) scrollToCurrentTrack();
    renderPlaylist();
  }

  function renderPlaylist() {
    const visCount = getVisibleTrackCount() || 8;
    const total = playlistTracks.length;

    // Clamp scroll offset
    const maxScroll = Math.max(0, total - visCount);
    playlistScrollOffset = Math.min(playlistScrollOffset, maxScroll);
    playlistScrollOffset = Math.max(0, playlistScrollOffset);

    // Build track rows
    plTrackList.innerHTML = "";
    const end = Math.min(playlistScrollOffset + visCount, total);
    for (let i = playlistScrollOffset; i < end; i++) {
      const t = playlistTracks[i];
      const row = document.createElement("div");
      row.className = "pl-track";
      if (i === playlistCurrentIndex) row.classList.add("pl-current");
      if (i === playlistSelectedIndex) row.classList.add("pl-selected");
      row.dataset.index = i;

      const num = document.createElement("span");
      num.className = "pl-track-number";
      num.textContent = (i + 1) + ".";

      const title = document.createElement("span");
      title.className = "pl-track-title";
      const displayTitle = t.artist
        ? t.artist + " - " + t.title
        : t.title || "Track " + (i + 1);
      title.textContent = displayTitle;

      const dur = document.createElement("span");
      dur.className = "pl-track-duration";
      dur.textContent = t.duration || "";

      row.appendChild(num);
      row.appendChild(title);
      row.appendChild(dur);
      plTrackList.appendChild(row);
    }

    // Update scrollbar handle position
    updateScrollHandle(total, visCount);
  }

  function updateScrollHandle(total, visCount) {
    if (!total || total <= visCount) {
      plScrollHandle.style.display = "none";
      return;
    }
    plScrollHandle.style.display = "block";
    const trackAreaH = plScrollbar.clientHeight;
    const handleH = 18;
    const maxTop = trackAreaH - handleH;
    const maxScroll = total - visCount;
    const top = maxScroll > 0 ? (playlistScrollOffset / maxScroll) * maxTop : 0;
    plScrollHandle.style.top = Math.round(top) + "px";
  }

  // ── Scrollbar drag ───────────────────────────────────────────────
  plScrollHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDraggingScrollbar = true;
    plScrollHandle.classList.add("active");
    const startY = e.clientY;
    const startTop = parseInt(plScrollHandle.style.top || "0", 10);
    const trackAreaH = plScrollbar.clientHeight;
    const handleH = 18;
    const maxTop = trackAreaH - handleH;
    const total = playlistTracks.length;
    const visCount = getVisibleTrackCount() || 8;
    const maxScroll = Math.max(0, total - visCount);

    function onMove(ev) {
      const dy = ev.clientY - startY;
      const newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      plScrollHandle.style.top = newTop + "px";
      playlistScrollOffset = Math.round((newTop / maxTop) * maxScroll);
      renderPlaylist();
    }
    function onUp() {
      isDraggingScrollbar = false;
      plScrollHandle.classList.remove("active");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Mouse wheel scrolling on track list
  plTrackList.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 3 : -3;
    playlistScrollOffset += delta;
    renderPlaylist();
  });

  // Click to select, double-click to play
  plTrackList.addEventListener("click", (e) => {
    const row = e.target.closest(".pl-track");
    if (!row) return;
    playlistSelectedIndex = parseInt(row.dataset.index, 10);
    renderPlaylist();
  });
  plTrackList.addEventListener("dblclick", (e) => {
    const row = e.target.closest(".pl-track");
    if (!row) return;
    const idx = parseInt(row.dataset.index, 10);
    sendCommand("playAt", idx);
  });

  // ── Event Handlers ─────────────────────────────────────────────────────
  btnPlay.addEventListener("click",  () => sendCommand("play"));
  btnPause.addEventListener("click", () => sendCommand("pause"));
  btnStop.addEventListener("click",  () => sendCommand("stop"));
  btnPrev.addEventListener("click",  () => sendCommand("prev"));
  btnNext.addEventListener("click",  () => sendCommand("next"));
  btnEject.addEventListener("click", () => sendMessage({ type: "OPEN_MUSIC" }));

  // EQ toggle
  btnEq.addEventListener("click", toggleEQ);
  eqBtnClose.addEventListener("click", toggleEQ);
  const eqTooltip = $("#eq-tooltip");
  let eqTooltipTimer = null;
  eqBtnOn.addEventListener("click", () => {
    eqBtnOn.classList.add("active");
    eqTooltip.classList.remove("hidden");
    clearTimeout(eqTooltipTimer);
    eqTooltipTimer = setTimeout(() => {
      eqBtnOn.classList.remove("active");
      eqTooltip.classList.add("hidden");
    }, 1500);
  });
  eqBtnAuto.addEventListener("click", () => eqBtnAuto.classList.toggle("active"));

  // PL toggle
  btnPl.addEventListener("click", togglePlaylist);
  plBtnClose.addEventListener("click", togglePlaylist);

  // Seek
  seekSlider.addEventListener("mousedown", () => { isSeeking = true; });
  seekSlider.addEventListener("input",     () => { isSeeking = true; });
  seekSlider.addEventListener("change", () => {
    sendCommand("seekTo", (seekSlider.value / 1000) * currentState.duration);
    isSeeking = false;
  });

  // Volume
  volumeSlider.addEventListener("mousedown", () => { isVolumeChanging = true; });
  volumeSlider.addEventListener("input", () => {
    isVolumeChanging = true;
    sendCommand("setVolume", parseInt(volumeSlider.value, 10));
    updateVolumeBackground();
  });
  volumeSlider.addEventListener("change", () => {
    sendCommand("setVolume", parseInt(volumeSlider.value, 10));
    isVolumeChanging = false;
  });
  volumeSlider.addEventListener("mouseup", () => { isVolumeChanging = false; });

  // Time toggle
  timeEl.addEventListener("click", () => {
    showRemaining = !showRemaining;
    updateTime();
  });

  // Shuffle / Repeat
  btnShuffle.addEventListener("click", () => sendCommand("toggleShuffle"));
  btnRepeat.addEventListener("click",  () => sendCommand("toggleRepeat"));

  // Window controls
  btnMinimize.addEventListener("click", () => {
    chrome.windows.getCurrent((w) => chrome.windows.update(w.id, { state: "minimized" }));
  });
  btnClose.addEventListener("click", () => window.close());

  // Load custom skin — double-click the title bar
  $("#title-bar").addEventListener("dblclick", (e) => {
    e.preventDefault();
    skinFileInput.click();
  });

  skinFileInput.addEventListener("change", async () => {
    const file = skinFileInput.files[0];
    if (!file) return;
    try {
      await window.SkinLoader.loadFromFile(file);
      // Clear image caches for marquee and kbps/khz
      Object.keys(charImageCache).forEach(k => delete charImageCache[k]);
      lastSmallText.clear();
      lastTrackKey = "";
      precacheCharImages();
      updateUI();
      applyAllSliderBgs();
      drawEQGraph();
      if (playlistVisible) renderPlaylist();
    } catch (err) {
      console.error("Failed to load skin:", err);
    }
    skinFileInput.value = "";
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case " ": case "p":
        e.preventDefault();
        sendCommand(currentState.state === "playing" ? "pause" : "play");
        break;
      case "s":
        e.preventDefault();
        sendCommand("stop");
        break;
      case "ArrowRight":
        e.preventDefault();
        (e.ctrlKey || e.metaKey)
          ? sendCommand("next")
          : sendCommand("seekTo", Math.min(currentState.currentTime + 5, currentState.duration));
        break;
      case "ArrowLeft":
        e.preventDefault();
        (e.ctrlKey || e.metaKey)
          ? sendCommand("prev")
          : sendCommand("seekTo", Math.max(currentState.currentTime - 5, 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        sendCommand("setVolume", Math.min(currentState.volume + 5, 100));
        break;
      case "ArrowDown":
        e.preventDefault();
        sendCommand("setVolume", Math.max(currentState.volume - 5, 0));
        break;
    }
  });

  // ── Pre-cache character images for digits and common chars ────────────
  function precacheCharImages() {
    const chars = window._skinCharacters || {};
    const needed = "0123456789 ";
    for (const ch of needed) {
      if (chars[ch] && !charImageCache[ch]) {
        loadCharImage(ch, chars[ch]);
      }
    }
  }

  // ── Load default skin and start ────────────────────────────────────────
  async function init() {
    try {
      const skinUrl = chrome.runtime.getURL("skins/base.wsz");
      await window.SkinLoader.loadAndApply(skinUrl);
    } catch (err) {
      console.warn("Failed to load default skin:", err);
    }
    // Pre-cache digit images so kbps/khz render on first poll
    precacheCharImages();
    // Init EQ slider drag + apply skin slider backgrounds
    initEQSliders();
    // Re-apply slider backgrounds now that both skin and positions are set
    applyAllSliderBgs();
    // Fit window exactly to the Winamp content (275×116)
    // Small delay so the window geometry has settled before measuring chrome overhead
    setTimeout(() => resizeWindowToContent(275, 116), 100);
    startVis();
    startPolling();
  }

  init();
})();
