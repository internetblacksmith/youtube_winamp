// YouTube Winamp — Content Script (isolated world, runs on music services)
// Per-service bridge scripts (bridge-youtube.js, bridge-spotify.js, bridge-amazon.js)
// run in the MAIN world and handle service-specific APIs. This script relays
// messages between the service worker and the bridge via postMessage.

(function () {
  "use strict";

  // ── Pending response callbacks ──────────────────────────────────────────
  const pending = new Map();

  // Listen for responses from the bridge (MAIN world)
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (!e.data) return;

    // Fire-and-forget messages from bridge
    if (e.data.direction === "YTWINAMP_BRIDGE_REQUEST" && e.data.type === "OPEN_WINAMP") {
      chrome.runtime.sendMessage({ type: "OPEN_WINAMP" });
      return;
    }

    if (e.data.direction !== "YTWINAMP_BRIDGE_RESPONSE") return;
    const { id, data } = e.data;
    const cb = pending.get(id);
    if (cb) {
      pending.delete(id);
      cb(data);
    }
  });

  function askBridge(payload) {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      pending.set(id, resolve);
      window.postMessage(
        {
          direction: "YTWINAMP_BRIDGE_REQUEST",
          id,
          ...payload,
        },
        "*"
      );
      // Timeout safety
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(null);
        }
      }, 2000);
    });
  }

  // ── Relay: service worker ↔ page bridge ─────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STATE") {
      askBridge({ type: "GET_STATE" }).then(sendResponse);
      return true;
    }
    if (message.type === "GET_QUEUE") {
      askBridge({ type: "GET_QUEUE" }).then(sendResponse);
      return true;
    }
    if (message.type === "COMMAND") {
      askBridge({
        type: "COMMAND",
        command: message.command,
        value: message.value,
      }).then(sendResponse);
      return true;
    }
  });
})();
