// YouTube Winamp — Page Bridge for Spotify Web Player (runs in MAIN world on open.spotify.com)
// Communicates with content.js via postMessage using the same protocol as bridge-youtube.js.

(function () {
  "use strict";

  // ── Audio Analysis (real FFT from media element) ──────────────────────
  var audioCtx = null;
  var analyser = null;
  var freqData = null;
  var audioConnected = false;
  var audioInitAttempted = false;
  var NUM_VIS_BARS = 19;

  function initAudioAnalysis() {
    if (audioInitAttempted) return;
    audioInitAttempted = true;
    try {
      var media = document.querySelector("video") || document.querySelector("audio");
      if (!media) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      var source = audioCtx.createMediaElementSource(media);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      audioConnected = true;
    } catch (e) {
      audioConnected = false;
    }
  }

  function getFrequencyBars() {
    if (!audioConnected || !analyser || !freqData) return null;
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    analyser.getByteFrequencyData(freqData);
    var hasSignal = false;
    for (var i = 0; i < freqData.length; i++) {
      if (freqData[i] > 0) { hasSignal = true; break; }
    }
    if (!hasSignal) return null;
    var n = freqData.length;
    var bars = [];
    for (var b = 0; b < NUM_VIS_BARS; b++) {
      var lo = Math.floor(b * n / NUM_VIS_BARS);
      var hi = Math.floor((b + 1) * n / NUM_VIS_BARS);
      if (hi <= lo) hi = lo + 1;
      var sum = 0;
      for (var j = lo; j < hi && j < n; j++) sum += freqData[j];
      bars.push((sum / (hi - lo)) / 255);
    }
    return bars;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function parseTime(str) {
    // Parse "M:SS" or "H:MM:SS" to seconds
    if (!str) return 0;
    var parts = str.trim().split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function clickButton(el) {
    if (!el) return false;
    el.click();
    return true;
  }

  // ── State ────────────────────────────────────────────────────────────────

  function getTrackInfo() {
    var title = "";
    var artist = "";

    // Try mediaSession first (most reliable)
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      var meta = navigator.mediaSession.metadata;
      title = meta.title || "";
      artist = meta.artist || "";
    }

    // Fallback: DOM now-playing bar
    if (!title) {
      var titleEl = document.querySelector('[data-testid="context-item-info-title"]') ||
                    document.querySelector('[data-testid="now-playing-widget"] [dir="auto"] a');
      if (titleEl) title = titleEl.textContent.trim();
    }
    if (!artist) {
      var artistEl = document.querySelector('[data-testid="context-item-info-artist"]') ||
                     document.querySelector('[data-testid="context-item-info-subtitles"] a');
      if (artistEl) artist = artistEl.textContent.trim();
    }

    return { title: title, artist: artist };
  }

  function getPlaybackState() {
    var btn = document.querySelector('[data-testid="control-button-playpause"]');
    if (!btn) return "stopped";
    // aria-label typically "Play" or "Pause"
    var label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label.indexOf("pause") !== -1) return "playing";
    if (label.indexOf("play") !== -1) return "paused";
    return "stopped";
  }

  function getShuffleState() {
    var btn = document.querySelector('[data-testid="control-button-shuffle"]');
    if (!btn) return false;
    return btn.getAttribute("aria-checked") === "true";
  }

  function getRepeatState() {
    var btn = document.querySelector('[data-testid="control-button-repeat"]');
    if (!btn) return "off";
    var checked = btn.getAttribute("aria-checked") === "true";
    if (!checked) return "off";
    // Distinguish repeat-all vs repeat-one via aria-label
    var label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label.indexOf("one") !== -1 || label.indexOf("repeat one") !== -1) return "one";
    // If "disable repeat" is the label, it means repeat-all is on
    if (label.indexOf("disable") !== -1) return "all";
    return "all";
  }

  function getVolume() {
    // Try the volume slider (progress bar inside volume area)
    var volumeBar = document.querySelector('[data-testid="volume-bar"]');
    if (volumeBar) {
      var progressBar = volumeBar.querySelector('[data-testid="progress-bar"]');
      if (progressBar) {
        var style = progressBar.style.cssText || "";
        var match = style.match(/--progress-bar-transform:\s*([\d.]+)%/);
        if (match) return Math.round(parseFloat(match[1]));
      }
      // Try aria-valuenow
      var slider = volumeBar.querySelector('input[type="range"]');
      if (slider) return Math.round(parseFloat(slider.value) * 100);
    }
    return 50;
  }

  function getState() {
    var state = getPlaybackState();
    var info = getTrackInfo();

    var posEl = document.querySelector('[data-testid="playback-position"]');
    var durEl = document.querySelector('[data-testid="playback-duration"]');
    var currentTime = parseTime(posEl ? posEl.textContent : "");
    var duration = parseTime(durEl ? durEl.textContent : "");

    return {
      state: state,
      currentTime: currentTime,
      duration: duration,
      volume: getVolume(),
      title: info.title,
      artist: info.artist,
      shuffle: getShuffleState(),
      repeat: getRepeatState(),
      kbps: 256,
      khz: 44,
    };
  }

  // ── Queue ────────────────────────────────────────────────────────────────

  function getQueue() {
    var tracks = [];
    var currentIndex = 0;

    // Try to get current track at minimum
    var info = getTrackInfo();
    if (info.title) {
      var durEl = document.querySelector('[data-testid="playback-duration"]');
      tracks.push({
        title: info.title,
        artist: info.artist,
        duration: durEl ? durEl.textContent.trim() : "",
        index: 0,
      });
    }

    // Try to get queue items from the queue panel
    var queueItems = document.querySelectorAll('[data-testid="queue-track-control"]');
    if (queueItems.length === 0) {
      queueItems = document.querySelectorAll('[data-testid="tracklist-row"]');
    }

    if (queueItems.length > 0) {
      tracks = [];
      for (var i = 0; i < queueItems.length; i++) {
        var item = queueItems[i];
        var titleEl = item.querySelector('[data-testid="internal-track-link"] div') ||
                      item.querySelector('a[href*="/track/"] div');
        var artistEl = item.querySelector('[data-testid="tracklist-row__artist-name-cell"] a') ||
                       item.querySelector('span a[href*="/artist/"]');
        var durEl2 = item.querySelector('[data-testid="tracklist-row__duration"]');

        var title = titleEl ? titleEl.textContent.trim() : "";
        var artist = artistEl ? artistEl.textContent.trim() : "";
        var duration = durEl2 ? durEl2.textContent.trim() : "";

        // Detect currently playing
        var isPlaying = item.querySelector('[aria-label="Now playing"]') ||
                        item.getAttribute("aria-current") === "true";
        if (isPlaying) currentIndex = i;

        tracks.push({ title: title, artist: artist, duration: duration, index: i });
      }
    }

    return { tracks: tracks, currentIndex: currentIndex };
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  function executeCommand(command, value) {
    switch (command) {
      case "play":
      case "pause": {
        var ppBtn = document.querySelector('[data-testid="control-button-playpause"]');
        return clickButton(ppBtn) ? { ok: true } : { ok: false, error: "No play/pause button" };
      }
      case "stop": {
        // Spotify has no stop — pause then seek to start
        var ppBtn2 = document.querySelector('[data-testid="control-button-playpause"]');
        var state = getPlaybackState();
        if (state === "playing" && ppBtn2) ppBtn2.click();
        seekToPosition(0);
        return { ok: true };
      }
      case "next": {
        var btn = document.querySelector('[data-testid="control-button-skip-forward"]');
        return clickButton(btn) ? { ok: true } : { ok: false, error: "No next button" };
      }
      case "prev": {
        var btn2 = document.querySelector('[data-testid="control-button-skip-back"]');
        return clickButton(btn2) ? { ok: true } : { ok: false, error: "No prev button" };
      }
      case "seekTo": {
        seekToPosition(value);
        return { ok: true };
      }
      case "setVolume": {
        setVolume(value);
        return { ok: true };
      }
      case "toggleShuffle": {
        var sBtn = document.querySelector('[data-testid="control-button-shuffle"]');
        return clickButton(sBtn) ? { ok: true } : { ok: false, error: "No shuffle button" };
      }
      case "toggleRepeat": {
        var rBtn = document.querySelector('[data-testid="control-button-repeat"]');
        return clickButton(rBtn) ? { ok: true } : { ok: false, error: "No repeat button" };
      }
      case "playAt": {
        // Try clicking a track in a visible tracklist
        var rows = document.querySelectorAll('[data-testid="tracklist-row"]');
        if (rows[value]) {
          var playBtn = rows[value].querySelector('button[data-testid="play-button"]') ||
                        rows[value].querySelector('button');
          if (playBtn) {
            playBtn.click();
            return { ok: true };
          }
          rows[value].click();
          return { ok: true };
        }
        return { ok: false, error: "Track not found" };
      }
      default:
        return { ok: false, error: "Unknown command: " + command };
    }
  }

  function seekToPosition(seconds) {
    var durEl = document.querySelector('[data-testid="playback-duration"]');
    var duration = parseTime(durEl ? durEl.textContent : "");
    if (duration <= 0) return;

    var fraction = Math.max(0, Math.min(1, seconds / duration));
    var progressBar = document.querySelector('[data-testid="progress-bar"]');
    if (!progressBar) return;

    var rect = progressBar.getBoundingClientRect();
    var x = rect.left + rect.width * fraction;
    var y = rect.top + rect.height / 2;

    progressBar.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
    progressBar.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
    progressBar.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
  }

  function setVolume(value) {
    // value: 0-100
    var volumeBar = document.querySelector('[data-testid="volume-bar"]');
    if (!volumeBar) return;

    var progressBar = volumeBar.querySelector('[data-testid="progress-bar"]') || volumeBar;
    var rect = progressBar.getBoundingClientRect();
    var fraction = Math.max(0, Math.min(1, value / 100));
    var x = rect.left + rect.width * fraction;
    var y = rect.top + rect.height / 2;

    progressBar.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
    progressBar.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
    progressBar.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
  }

  // ── Message listener (same protocol as YouTube bridge) ───────────────────
  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    if (!e.data || e.data.direction !== "YTWINAMP_BRIDGE_REQUEST") return;

    var id = e.data.id;
    var type = e.data.type;
    var data = null;

    if (type === "GET_STATE") {
      data = getState();
    } else if (type === "GET_QUEUE") {
      data = getQueue();
    } else if (type === "GET_AUDIO_DATA") {
      initAudioAnalysis();
      var bars = getFrequencyBars();
      data = bars ? { bars: bars, real: true } : { bars: null, real: false };
    } else if (type === "COMMAND") {
      data = executeCommand(e.data.command, e.data.value);
    }

    window.postMessage(
      {
        direction: "YTWINAMP_BRIDGE_RESPONSE",
        id: id,
        data: data,
      },
      "*"
    );
  });
})();
