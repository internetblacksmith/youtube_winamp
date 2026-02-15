# YouTube Winamp

A Chrome extension that recreates the classic **Winamp 2.x** player as a standalone window to control **YouTube Music**, **Spotify**, and **Amazon Music**. Pure nostalgia — no frameworks, no build tools, no image assets.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen)

---

## Features

| Feature | Description |
|---------|-------------|
| **Play / Pause / Stop** | Full transport control over YouTube Music, Spotify, and Amazon Music |
| **Previous / Next** | Navigate the track queue |
| **Seek bar** | Scrub through the current track |
| **Volume slider** | Adjust volume (0–100) |
| **Track info marquee** | Scrolling title + artist with seamless loop |
| **LCD time display** | Green segmented digits — click to toggle elapsed/remaining |
| **Blinking pause** | Time display blinks when paused, just like the original |
| **Shuffle / Repeat** | Toggle shuffle and cycle repeat modes (off → all → one) |
| **Eject button** | Opens or focuses the active music service tab |
| **Connection indicator** | Green dot when connected, red when no music tab found |
| **Keyboard shortcuts** | Full keyboard control (see table below) |
| **WSZ skin support** | Load classic Winamp skins — double-click the title bar |
| **Equalizer** | 10-band EQ with graph, ON/AUTO buttons, and skinnable sliders |
| **Playlist editor** | Scrollable track list with queue from the active service |

### Supported Services

| Service | Bridge | API |
|---------|--------|-----|
| YouTube Music | `bridge-youtube.js` | `#movie_player` embedded player API |
| Spotify | `bridge-spotify.js` | DOM selectors + `mediaSession` |
| Amazon Music | `bridge-amazon.js` | Maestro player API + DOM fallbacks |

---

## Architecture

```
┌──────────────────────┐         ┌───────────────────┐         ┌────────────────────────┐
│   Winamp Window      │  chrome │   Service Worker   │  chrome │   Content Script        │
│   winamp.html/css/js │ ──────→ │   background.js    │ ──────→ │   content.js (isolated) │
│                      │ runtime │                    │  tabs   │          │               │
│   Renders UI         │ ←────── │   Routes messages  │ ←────── │          ↓ postMessage   │
│   Polls state @500ms │         │   Manages window   │         │   Bridge (page context)  │
│                      │         │   Finds music tab  │         │   Service-specific API   │
└──────────────────────┘         └───────────────────┘         └────────────────────────┘
```

### Why three messaging layers?

1. **Winamp ↔ Service Worker** — `chrome.runtime.sendMessage` connects the popup window to the extension backend
2. **Service Worker ↔ Content Script** — `chrome.tabs.sendMessage` targets the music service tab specifically
3. **Content Script ↔ Bridge** — `window.postMessage` crosses the isolated-world / page-context boundary (required because `CustomEvent.detail` objects are not cloneable between worlds)

### Polling model

The UI polls for playback state every **500ms**. This is intentionally simple:
- Self-healing: no persistent connection to break
- Wakes idle service workers automatically
- Avoids race conditions from event-driven state sync

---

## File Structure

```
youtube_winamp/
├── manifest.json          MV3 extension configuration
├── background.js          Service worker — window lifecycle + message routing
├── content.js             Content script relay (isolated world)
├── bridge-youtube.js      YouTube Music bridge (MAIN world, #movie_player API)
├── bridge-spotify.js      Spotify bridge (MAIN world, DOM + mediaSession)
├── bridge-amazon.js       Amazon Music bridge (MAIN world, maestro API + DOM)
├── skin-loader.js         WSZ skin parser — extracts BMP sprites into CSS
├── winamp.html            Winamp window markup
├── winamp.css             Pure CSS Winamp 2.x layout (275×116)
├── winamp.js              UI controller — polling, rendering, event handlers
├── vendor/
│   └── jszip.min.js       ZIP extraction for .wsz skin files
├── skins/
│   └── base.wsz           Default Winamp skin
├── fonts/
│   ├── PressStart2P-latin.woff2
│   └── PressStart2P-latin-ext.woff2
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

No build step. No `node_modules`. No React. Just files.

---

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `youtube_winamp/` folder
5. The extension icon appears in your toolbar

## Usage

1. Open any supported music service ([YouTube Music](https://music.youtube.com), [Spotify](https://open.spotify.com), or [Amazon Music](https://music.amazon.com)) and start playing a song
2. Click the **YouTube Winamp** extension icon in the toolbar
3. A Winamp-style popup window opens and auto-connects to your music tab
4. Control playback from the Winamp window — all actions are mirrored in the music service

> **Tip:** If the connection dot is red, make sure you have a music service tab open and try reloading it.

---

## Keyboard Shortcuts

All shortcuts work when the Winamp window is focused:

| Key | Action |
|-----|--------|
| `Space` or `P` | Play / Pause toggle |
| `S` | Stop |
| `←` | Seek backward 5 seconds |
| `→` | Seek forward 5 seconds |
| `Ctrl/Cmd + ←` | Previous track |
| `Ctrl/Cmd + →` | Next track |
| `↑` | Volume up (+5) |
| `↓` | Volume down (-5) |

---

## Skin Support

Double-click the title bar to load a custom `.wsz` Winamp skin. The skin loader:

- Extracts BMP sprite sheets from the ZIP archive
- Maps sprite coordinates using the Winamp 2.x skin spec
- Generates CSS with data URI backgrounds for each UI element
- Parses `VISCOLOR.TXT` for visualizer colors
- Parses `PLEDIT.TXT` for playlist editor colors

Skins are processed entirely in memory and are not stored.

---

## CSS Approach

The entire Winamp skin layout is pure CSS — no bitmap assets for the base structure:

- **3D beveled borders** using directional `border-color` (highlight top-left, shadow bottom-right)
- **LCD green glow** via `text-shadow` with transparent green
- **Segmented digit look** using the bundled `Press Start 2P` pixel font
- **Transport icons** as inline SVGs with CSS fill colors
- **Titlebar grip** pattern using `repeating-linear-gradient`
- **Button press effect** by swapping border highlight/shadow colors on `:active`
- **Blinking animations** using `@keyframes` with `step-end` timing for authentic LCD blink

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Polling over events** | Service workers can go idle; polling self-heals. Simpler than maintaining persistent connections. |
| **postMessage over CustomEvent** | CustomEvent `detail` isn't cloneable across isolated/page context boundary in Chrome extensions. |
| **Bundled font** | Extension CSP can block external font loading; bundling guarantees the pixel font always renders. |
| **SVG transport icons** | CSS triangle hacks are fragile; inline SVGs render crisply at any size and are easy to color. |
| **No build tools** | The extension is small enough that raw files are simpler to develop, debug, and distribute. |
| **Seek slider normalized to 0–1000** | HTML range inputs work with integers; 1000 steps gives smooth seeking without floating point issues. |
| **Per-service bridges** | Each music service has a wildly different DOM and API; isolated bridges keep logic clean and maintainable. |

---

## Troubleshooting

**Window opens but shows red dot (no music tab found):**
- Make sure you have YouTube Music, Spotify, or Amazon Music open in a tab
- Reload the music tab after installing/updating the extension (the content script injects on page load)

**Buttons don't respond:**
- Reload the music service tab — the bridge script needs to re-inject
- Check `chrome://extensions` for any error messages on the extension card

**Font looks wrong:**
- The `Press Start 2P` font is bundled locally — if it doesn't load, check the browser console in the Winamp window for font loading errors

---

## License

MIT
