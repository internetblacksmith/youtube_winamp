// YouTube Winamp — Page Bridge for Amazon Music (runs in MAIN world on music.amazon.com)
// Communicates with content.js via postMessage using the same protocol as bridge-youtube.js.
// Uses the maestro player API when available, with DOM fallbacks.

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
    if (!str) return 0;
    var parts = str.trim().split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function getMaestro() {
    // Amazon Music exposes the maestro player API on the window in some builds
    return window.maestroController || window.maestro || null;
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

    // Try mediaSession first
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      var meta = navigator.mediaSession.metadata;
      title = meta.title || "";
      artist = meta.artist || "";
    }

    // DOM fallback: Amazon Music uses custom web components
    if (!title) {
      var titleEl = document.querySelector('music-horizontal-item[now-playing] [slot="primaryText"]') ||
                    document.querySelector('[class*="trackTitle"]') ||
                    document.querySelector('[data-testid="track-title"]') ||
                    document.querySelector('.playerBarNowPlayingTitle') ||
                    document.querySelector('music-text-header[primary-text]');
      if (titleEl) {
        title = titleEl.getAttribute("primary-text") || titleEl.textContent.trim();
      }
    }
    if (!artist) {
      var artistEl = document.querySelector('music-horizontal-item[now-playing] [slot="secondaryText"]') ||
                     document.querySelector('[class*="artistName"]') ||
                     document.querySelector('[data-testid="track-artist"]') ||
                     document.querySelector('.playerBarNowPlayingArtist');
      if (artistEl) {
        artist = artistEl.getAttribute("secondary-text") || artistEl.textContent.trim();
      }
    }

    return { title: title, artist: artist };
  }

  function getPlaybackState() {
    var maestro = getMaestro();
    if (maestro) {
      try {
        var ps = maestro.getPlaybackState ? maestro.getPlaybackState() : null;
        if (ps === "PLAYING") return "playing";
        if (ps === "PAUSED") return "paused";
        if (ps) return "stopped";
      } catch (e) { /* fallback to DOM */ }
    }

    // DOM fallback: check play/pause button state
    var playBtn = document.querySelector('music-button[icon-name="play"]') ||
                  document.querySelector('[data-testid="play-button"]') ||
                  document.querySelector('button[aria-label="Play"]');
    var pauseBtn = document.querySelector('music-button[icon-name="pause"]') ||
                   document.querySelector('[data-testid="pause-button"]') ||
                   document.querySelector('button[aria-label="Pause"]');

    if (pauseBtn && pauseBtn.offsetParent !== null) return "playing";
    if (playBtn && playBtn.offsetParent !== null) return "paused";

    // Check media session playback state
    if (navigator.mediaSession && navigator.mediaSession.playbackState) {
      var mps = navigator.mediaSession.playbackState;
      if (mps === "playing") return "playing";
      if (mps === "paused") return "paused";
    }

    return "stopped";
  }

  function getCurrentTime() {
    var maestro = getMaestro();
    if (maestro && maestro.getCurrentTime) {
      try { return maestro.getCurrentTime(); } catch (e) { /* fallback */ }
    }
    // DOM: look for elapsed time display
    var el = document.querySelector('[class*="elapsed"]') ||
             document.querySelector('[data-testid="playback-position"]') ||
             document.querySelector('.playbackControls_timeline_elapsedTime');
    return parseTime(el ? el.textContent : "");
  }

  function getDuration() {
    var maestro = getMaestro();
    if (maestro && maestro.getDuration) {
      try { return maestro.getDuration(); } catch (e) { /* fallback */ }
    }
    var el = document.querySelector('[class*="duration"]:not([class*="elapsed"])') ||
             document.querySelector('[data-testid="playback-duration"]') ||
             document.querySelector('.playbackControls_timeline_duration');
    return parseTime(el ? el.textContent : "");
  }

  function getVolume() {
    var maestro = getMaestro();
    if (maestro && maestro.getVolume) {
      try { return Math.round(maestro.getVolume() * 100); } catch (e) { /* fallback */ }
    }
    // DOM fallback
    var slider = document.querySelector('input[type="range"][aria-label*="olume"]') ||
                 document.querySelector('music-volume-slider input');
    if (slider) return Math.round(parseFloat(slider.value) * 100);
    return 50;
  }

  function getShuffleState() {
    var btn = document.querySelector('music-button[icon-name="shuffle"]') ||
              document.querySelector('[data-testid="shuffle-button"]') ||
              document.querySelector('button[aria-label*="huffle"]');
    if (!btn) return false;
    return btn.getAttribute("aria-checked") === "true" ||
           btn.classList.contains("active") ||
           btn.getAttribute("variant") === "accent";
  }

  function getRepeatState() {
    var btn = document.querySelector('music-button[icon-name="repeat"]') ||
              document.querySelector('music-button[icon-name="repeat-one"]') ||
              document.querySelector('[data-testid="repeat-button"]') ||
              document.querySelector('button[aria-label*="epeat"]');
    if (!btn) return "off";

    var iconName = btn.getAttribute("icon-name") || "";
    if (iconName === "repeat-one") return "one";

    var checked = btn.getAttribute("aria-checked") === "true" ||
                  btn.classList.contains("active") ||
                  btn.getAttribute("variant") === "accent";
    return checked ? "all" : "off";
  }

  function getState() {
    var state = getPlaybackState();
    var info = getTrackInfo();

    return {
      state: state,
      currentTime: getCurrentTime(),
      duration: getDuration(),
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

    // Current track as fallback
    var info = getTrackInfo();

    // Try to get queue from DOM (Amazon uses music-horizontal-item components)
    var queueItems = document.querySelectorAll('music-horizontal-item');
    if (queueItems.length > 0) {
      for (var i = 0; i < queueItems.length; i++) {
        var item = queueItems[i];
        var title = item.getAttribute("primary-text") || "";
        var artist = item.getAttribute("secondary-text") || "";
        var duration = item.getAttribute("secondary-text-2") || "";

        if (item.hasAttribute("now-playing") || item.hasAttribute("is-playing")) {
          currentIndex = i;
        }

        if (title) {
          tracks.push({ title: title, artist: artist, duration: duration, index: i });
        }
      }
    }

    // Fallback: just show current track
    if (tracks.length === 0 && info.title) {
      tracks.push({
        title: info.title,
        artist: info.artist,
        duration: "",
        index: 0,
      });
      currentIndex = 0;
    }

    return { tracks: tracks, currentIndex: currentIndex };
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  function executeCommand(command, value) {
    var maestro = getMaestro();

    switch (command) {
      case "play": {
        if (maestro && maestro.play) {
          try { maestro.play(); return { ok: true }; } catch (e) { /* fallback */ }
        }
        var btn = document.querySelector('music-button[icon-name="play"]') ||
                  document.querySelector('[data-testid="play-button"]') ||
                  document.querySelector('button[aria-label="Play"]');
        return clickButton(btn) ? { ok: true } : { ok: false, error: "No play button" };
      }
      case "pause": {
        if (maestro && maestro.pause) {
          try { maestro.pause(); return { ok: true }; } catch (e) { /* fallback */ }
        }
        var btn2 = document.querySelector('music-button[icon-name="pause"]') ||
                   document.querySelector('[data-testid="pause-button"]') ||
                   document.querySelector('button[aria-label="Pause"]');
        return clickButton(btn2) ? { ok: true } : { ok: false, error: "No pause button" };
      }
      case "stop": {
        if (maestro && maestro.pause) {
          try { maestro.pause(); } catch (e) { /* fallback to click */ }
        }
        if (maestro && maestro.seekTo) {
          try { maestro.seekTo(0); return { ok: true }; } catch (e) { /* fallback */ }
        }
        // DOM fallback
        var pauseBtn = document.querySelector('music-button[icon-name="pause"]') ||
                       document.querySelector('button[aria-label="Pause"]');
        if (pauseBtn) pauseBtn.click();
        return { ok: true };
      }
      case "next": {
        if (maestro && maestro.next) {
          try { maestro.next(); return { ok: true }; } catch (e) { /* fallback */ }
        }
        var btn3 = document.querySelector('music-button[icon-name="next"]') ||
                   document.querySelector('[data-testid="next-button"]') ||
                   document.querySelector('button[aria-label="Next"]');
        return clickButton(btn3) ? { ok: true } : { ok: false, error: "No next button" };
      }
      case "prev": {
        if (maestro && maestro.previous) {
          try { maestro.previous(); return { ok: true }; } catch (e) { /* fallback */ }
        }
        var btn4 = document.querySelector('music-button[icon-name="previous"]') ||
                   document.querySelector('[data-testid="previous-button"]') ||
                   document.querySelector('button[aria-label="Previous"]');
        return clickButton(btn4) ? { ok: true } : { ok: false, error: "No prev button" };
      }
      case "seekTo": {
        if (maestro && maestro.seekTo) {
          try { maestro.seekTo(value); return { ok: true }; } catch (e) { /* fallback */ }
        }
        // DOM fallback: click on progress bar
        seekToPosition(value);
        return { ok: true };
      }
      case "setVolume": {
        if (maestro && maestro.setVolume) {
          try { maestro.setVolume(value / 100); return { ok: true }; } catch (e) { /* fallback */ }
        }
        // DOM fallback
        var slider = document.querySelector('input[type="range"][aria-label*="olume"]') ||
                     document.querySelector('music-volume-slider input');
        if (slider) {
          var nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          nativeSet.call(slider, value / 100);
          slider.dispatchEvent(new Event("input", { bubbles: true }));
          slider.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true };
        }
        return { ok: false, error: "No volume control" };
      }
      case "toggleShuffle": {
        var sBtn = document.querySelector('music-button[icon-name="shuffle"]') ||
                   document.querySelector('[data-testid="shuffle-button"]') ||
                   document.querySelector('button[aria-label*="huffle"]');
        return clickButton(sBtn) ? { ok: true } : { ok: false, error: "No shuffle button" };
      }
      case "toggleRepeat": {
        var rBtn = document.querySelector('music-button[icon-name="repeat"]') ||
                   document.querySelector('music-button[icon-name="repeat-one"]') ||
                   document.querySelector('[data-testid="repeat-button"]') ||
                   document.querySelector('button[aria-label*="epeat"]');
        return clickButton(rBtn) ? { ok: true } : { ok: false, error: "No repeat button" };
      }
      case "playAt": {
        var items = document.querySelectorAll('music-horizontal-item');
        if (items[value]) {
          items[value].click();
          return { ok: true };
        }
        return { ok: false, error: "Track not found" };
      }
      default:
        return { ok: false, error: "Unknown command: " + command };
    }
  }

  function seekToPosition(seconds) {
    var duration = getDuration();
    if (duration <= 0) return;

    var fraction = Math.max(0, Math.min(1, seconds / duration));
    var progressBar = document.querySelector('music-progress-bar') ||
                      document.querySelector('[class*="progressBar"]') ||
                      document.querySelector('[data-testid="progress-bar"]');
    if (!progressBar) return;

    var rect = progressBar.getBoundingClientRect();
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
