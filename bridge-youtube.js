// YouTube Winamp — Page Bridge (runs in MAIN world on music.youtube.com)
// Has direct access to #movie_player API. Communicates with content.js via postMessage.

(function () {
  "use strict";

  function getPlayer() {
    return document.getElementById("movie_player");
  }

  function getTrackInfo() {
    const titleEl =
      document.querySelector("ytmusic-player-bar .title.ytmusic-player-bar") ||
      document.querySelector("ytmusic-player-bar .content-info-wrapper .title") ||
      document.querySelector(".ytmusic-player-bar .title") ||
      document.querySelector("yt-formatted-string.title");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const artistEl =
      document.querySelector("ytmusic-player-bar .byline.ytmusic-player-bar") ||
      document.querySelector("ytmusic-player-bar .content-info-wrapper .byline") ||
      document.querySelector(".ytmusic-player-bar .byline") ||
      document.querySelector("yt-formatted-string.byline");
    const artist = artistEl ? artistEl.textContent.trim() : "";

    return { title, artist };
  }

  function getShuffleRepeatState() {
    var shuffleBtn =
      document.querySelector("[aria-label='Turn on shuffle']") ||
      document.querySelector("[aria-label='Turn off shuffle']");
    var shuffle = shuffleBtn
      ? shuffleBtn.getAttribute("aria-label") === "Turn off shuffle"
      : false;

    var repeatBtn =
      document.querySelector("[aria-label='Turn on repeat']") ||
      document.querySelector("[aria-label='Turn off repeat']") ||
      document.querySelector("[aria-label='Turn off repeat one']");
    var repeat = "off";
    if (repeatBtn) {
      var label = repeatBtn.getAttribute("aria-label");
      if (label === "Turn off repeat") repeat = "all";
      else if (label === "Turn off repeat one") repeat = "one";
    }

    return { shuffle, repeat };
  }

  function getAudioQuality(player) {
    var kbps = 128;
    var khz = 44;
    try {
      var response = player.getPlayerResponse ? player.getPlayerResponse() : null;
      if (response && response.streamingData && response.streamingData.adaptiveFormats) {
        var formats = response.streamingData.adaptiveFormats;
        var bestAudio = null;
        for (var i = 0; i < formats.length; i++) {
          var f = formats[i];
          if (f.mimeType && f.mimeType.indexOf("audio") === 0) {
            if (!bestAudio || (f.bitrate && f.bitrate > bestAudio.bitrate)) {
              bestAudio = f;
            }
          }
        }
        if (bestAudio) {
          if (bestAudio.bitrate) kbps = Math.round(bestAudio.bitrate / 1000);
          if (bestAudio.audioSampleRate) khz = Math.round(parseInt(bestAudio.audioSampleRate, 10) / 1000);
        }
      }
    } catch (e) { /* fall back to defaults */ }
    return { kbps: kbps, khz: khz };
  }

  function getState() {
    var player = getPlayer();
    if (!player || typeof player.getPlayerState !== "function") {
      return null;
    }

    var ps = player.getPlayerState();
    var state = "stopped";
    if (ps === 1 || ps === 3) state = "playing";
    else if (ps === 2) state = "paused";

    var currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
    var duration = player.getDuration ? player.getDuration() : 0;
    var volume = player.getVolume ? player.getVolume() : 50;
    var isMuted = player.isMuted ? player.isMuted() : false;

    var info = getTrackInfo();
    var sr = getShuffleRepeatState();
    var audio = getAudioQuality(player);

    return {
      state: state,
      currentTime: currentTime,
      duration: duration,
      volume: isMuted ? 0 : volume,
      title: info.title,
      artist: info.artist,
      shuffle: sr.shuffle,
      repeat: sr.repeat,
      kbps: audio.kbps,
      khz: audio.khz,
    };
  }

  // Get only visible queue items (filters out hidden song/video duplicates)
  function getVisibleQueueItems() {
    var all = document.querySelectorAll("ytmusic-player-queue-item");
    var visible = [];
    all.forEach(function (item) {
      // Skip items hidden by CSS (e.g. the song/video alternate version)
      if (item.offsetParent !== null && item.offsetHeight > 0) {
        visible.push(item);
      }
    });
    return visible;
  }

  function getQueue() {
    var player = getPlayer();
    if (!player) return null;

    var currentIndex = -1;

    // Get titles/artists from queue DOM (YouTube Music "Up Next" panel)
    // Only visible items — YT Music hides the song/video duplicate
    var queueItems = getVisibleQueueItems();

    var tracks = [];
    if (queueItems.length > 0) {
      for (var i = 0; i < queueItems.length; i++) {
        var item = queueItems[i];
        var titleEl = item.querySelector("yt-formatted-string.song-title") ||
                      item.querySelector(".song-title");
        var artistEl = item.querySelector("yt-formatted-string.byline") ||
                       item.querySelector(".byline");
        var durationEl = item.querySelector("yt-formatted-string.duration") ||
                         item.querySelector(".duration");
        var title = titleEl ? titleEl.textContent.trim() : "";
        var artist = artistEl ? artistEl.textContent.trim() : "";
        var duration = durationEl ? durationEl.textContent.trim() : "";

        // Detect currently playing item from DOM attributes
        if (item.hasAttribute("selected") ||
            item.getAttribute("play-button-state") === "playing" ||
            item.getAttribute("play-button-state") === "paused") {
          currentIndex = i;
        }

        tracks.push({ title: title, artist: artist, duration: duration, index: i });
      }
    }

    // Fallback: use player API for video IDs
    if (tracks.length === 0) {
      var videoIds = player.getPlaylist ? player.getPlaylist() : [];
      var plIndex = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
      if (videoIds && videoIds.length > 0) {
        var currentData = player.getVideoData ? player.getVideoData() : null;
        videoIds.forEach(function (id, i) {
          var title = id;
          var artist = "";
          if (currentData && i === plIndex) {
            title = currentData.title || id;
            artist = currentData.author || "";
          }
          tracks.push({ title: title, artist: artist, duration: "", index: i });
        });
        currentIndex = plIndex;
      }
    }

    // Last resort: at least show the currently playing track
    if (tracks.length === 0) {
      var info = getTrackInfo();
      if (info.title) {
        tracks.push({ title: info.title, artist: info.artist, duration: "", index: 0 });
        currentIndex = 0;
      }
    }

    // If we still couldn't detect currentIndex from DOM, match by title
    if (currentIndex === -1 && tracks.length > 0) {
      var nowPlaying = getTrackInfo();
      if (nowPlaying.title) {
        for (var j = 0; j < tracks.length; j++) {
          if (tracks[j].title === nowPlaying.title) {
            currentIndex = j;
            break;
          }
        }
      }
    }

    return { tracks: tracks, currentIndex: currentIndex };
  }

  function executeCommand(command, value) {
    var player = getPlayer();
    if (!player) return { ok: false, error: "No player" };

    switch (command) {
      case "play":
        if (player.playVideo) player.playVideo();
        break;
      case "pause":
        if (player.pauseVideo) player.pauseVideo();
        break;
      case "stop":
        if (player.pauseVideo) player.pauseVideo();
        if (player.seekTo) player.seekTo(0, true);
        break;
      case "next":
        if (player.nextVideo) player.nextVideo();
        break;
      case "prev":
        if (player.previousVideo) player.previousVideo();
        break;
      case "seekTo":
        if (player.seekTo) player.seekTo(value, true);
        break;
      case "setVolume":
        if (player.unMute) player.unMute();
        if (player.setVolume) player.setVolume(value);
        break;
      case "toggleShuffle": {
        var btn =
          document.querySelector("[aria-label='Turn on shuffle']") ||
          document.querySelector("[aria-label='Turn off shuffle']");
        if (btn) btn.click();
        break;
      }
      case "toggleRepeat": {
        var btn2 =
          document.querySelector("[aria-label='Turn on repeat']") ||
          document.querySelector("[aria-label='Turn off repeat']") ||
          document.querySelector("[aria-label='Turn off repeat one']");
        if (btn2) btn2.click();
        break;
      }
      case "playAt": {
        // Click the visible queue item in the DOM to play it
        var visibleItems = getVisibleQueueItems();
        var target = visibleItems[value];
        if (target) {
          // Try multiple click strategies:
          // 1. The play button overlay
          var pb = target.querySelector("tp-yt-paper-icon-button#play-button") ||
                   target.querySelector("#play-button");
          if (pb) {
            pb.click();
          } else {
            // 2. The song title link
            var titleLink = target.querySelector("yt-formatted-string.song-title a") ||
                            target.querySelector("yt-formatted-string.song-title") ||
                            target.querySelector(".song-title");
            if (titleLink) {
              titleLink.click();
            } else {
              // 3. The item itself
              target.click();
            }
          }
        } else if (player.playVideoAt) {
          player.playVideoAt(value);
        }
        break;
      }
      default:
        return { ok: false, error: "Unknown command: " + command };
    }
    return { ok: true };
  }

  // ── Winamp navbar button ───────────────────────────────────────────────
  var WINAMP_BTN_ID = "ytwinamp-nav-btn";

  function injectWinampButton() {
    // Already injected
    if (document.getElementById(WINAMP_BTN_ID)) return;

    var rightContent = document.querySelector("ytmusic-nav-bar #right-content");
    if (!rightContent) return;

    var castBtn = rightContent.querySelector("ytmusic-cast-button.cast-button") ||
                  rightContent.querySelector("ytmusic-cast-button");

    var btn = document.createElement("button");
    btn.id = WINAMP_BTN_ID;
    btn.title = "Open Winamp";
    btn.setAttribute("aria-label", "Open Winamp");
    btn.style.cssText =
      "background:none;border:none;cursor:pointer;padding:8px;display:flex;" +
      "align-items:center;justify-content:center;opacity:0.7;transition:opacity .2s;";
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M13 2L4 14h6l-2 8 9-12h-6l2-8z");
    path.setAttribute("fill", "#fff");
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.addEventListener("mouseenter", function () { btn.style.opacity = "1"; });
    btn.addEventListener("mouseleave", function () { btn.style.opacity = "0.7"; });
    btn.addEventListener("click", function () {
      window.postMessage({ direction: "YTWINAMP_BRIDGE_REQUEST", type: "OPEN_WINAMP" }, "*");
    });

    if (castBtn) {
      rightContent.insertBefore(btn, castBtn);
    } else {
      rightContent.appendChild(btn);
    }
  }

  // YouTube Music is an SPA — re-inject if the button disappears
  setInterval(injectWinampButton, 2000);
  // Also try immediately and after a short delay for initial page load
  injectWinampButton();
  setTimeout(injectWinampButton, 1000);

  // Listen for requests from content script via postMessage
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
