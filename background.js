// YouTube Winamp - Service Worker
// Routes messages between Winamp window and content script on music services

let winampWindowId = null;
let lastService = null; // remember last connected service

const SERVICE_PATTERNS = [
  { pattern: "*://music.youtube.com/*", name: "youtube", openUrl: "https://music.youtube.com" },
  { pattern: "*://open.spotify.com/*",  name: "spotify",  openUrl: "https://open.spotify.com" },
  { pattern: "*://music.amazon.com/*",  name: "amazon",   openUrl: "https://music.amazon.com" },
];

// Open or focus the Winamp popup window
async function openOrFocusWinamp() {
  if (winampWindowId !== null) {
    try {
      const win = await chrome.windows.get(winampWindowId);
      if (win) {
        await chrome.windows.update(winampWindowId, { focused: true });
        return;
      }
    } catch {
      winampWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("winamp.html"),
    type: "popup",
    width: 275,
    height: 150,
    focused: true
  });
  winampWindowId = win.id;
}

// Open Winamp window when extension icon is clicked
chrome.action.onClicked.addListener(() => openOrFocusWinamp());

// Clean up when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === winampWindowId) {
    winampWindowId = null;
  }
});

// Find an active music tab across all supported services
async function findMusicTab() {
  for (const svc of SERVICE_PATTERNS) {
    const tabs = await chrome.tabs.query({ url: svc.pattern });
    const tab = tabs.find(t => t.audible) || tabs[0];
    if (tab) {
      lastService = svc;
      return { tab, service: svc };
    }
  }
  return null;
}

// Message routing between Winamp window and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    findMusicTab().then(result => {
      if (!result) {
        sendResponse({ connected: false });
        return;
      }
      chrome.tabs.sendMessage(result.tab.id, { type: "GET_STATE" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          sendResponse({ connected: false });
        } else {
          sendResponse({ ...response, connected: true, service: result.service.name });
        }
      });
    });
    return true;
  }

  if (message.type === "GET_QUEUE") {
    findMusicTab().then(result => {
      if (!result) {
        sendResponse(null);
        return;
      }
      chrome.tabs.sendMessage(result.tab.id, { type: "GET_QUEUE" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          sendResponse(null);
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }

  if (message.type === "RESIZE_WINDOW") {
    if (winampWindowId !== null) {
      chrome.windows.update(winampWindowId, {
        width: message.width,
        height: message.height
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "COMMAND") {
    findMusicTab().then(result => {
      if (!result) {
        sendResponse({ ok: false, error: "No music tab found" });
        return;
      }
      chrome.tabs.sendMessage(result.tab.id, { type: "COMMAND", command: message.command, value: message.value }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response || { ok: true });
        }
      });
    });
    return true;
  }

  if (message.type === "OPEN_MUSIC") {
    const svc = lastService || SERVICE_PATTERNS[0];
    findMusicTab().then(async (result) => {
      if (result) {
        await chrome.tabs.update(result.tab.id, { active: true });
        await chrome.windows.update(result.tab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: svc.openUrl });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "OPEN_WINAMP") {
    openOrFocusWinamp();
    return false;
  }

  // Keep backwards compat for OPEN_YT_MUSIC
  if (message.type === "OPEN_YT_MUSIC") {
    findMusicTab().then(async (result) => {
      if (result) {
        await chrome.tabs.update(result.tab.id, { active: true });
        await chrome.windows.update(result.tab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: "https://music.youtube.com" });
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});
