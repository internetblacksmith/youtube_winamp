# YouTube Winamp -- Security Audit Findings

Audit date: 2026-02-26

## Overall Assessment

The codebase is well-written with good practices (no `eval`, strict permission scoping, `createElement` over `innerHTML` in most places). The primary attack surface is the postMessage communication channel between isolated-world and MAIN-world scripts. Seven findings identified across four severity tiers.

---

## HIGH

### 1. PostMessage Origin Spoofing (CWE-346)

**Files:** `content.js:37`, `bridge-youtube.js:313,346`, `bridge-spotify.js:283`, `bridge-amazon.js:360`

All `postMessage` calls use `"*"` as target origin. Bridge scripts only validate a lightweight direction field (`e.data.direction === "YTWINAMP_BRIDGE_REQUEST"`). Any script running on YouTube Music, Spotify, or Amazon Music (ads, injected scripts, XSS) can craft matching messages to control playback or spoof responses.

**PoC (from YouTube Music console):**
```javascript
window.postMessage({
  direction: "YTWINAMP_BRIDGE_REQUEST",
  id: "attacker1",
  type: "COMMAND",
  command: "stop"
}, "*");
```

**Fix:** Generate a cryptographic session nonce at content-script injection time. Validate it on every message in both content.js and bridge scripts.

```javascript
// content.js -- generate nonce
const SESSION_NONCE = crypto.getRandomValues(new Uint8Array(16))
  .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

// Include in every outgoing message
window.postMessage({
  direction: "YTWINAMP_BRIDGE_REQUEST",
  nonce: SESSION_NONCE,
  id, ...payload
}, "*");

// bridge -- reject messages without valid nonce
if (e.data.nonce !== EXPECTED_NONCE) return;
```

**Nonce delivery:** Content script (isolated world) sets a DOM attribute or dispatches a CustomEvent with the nonce before the bridge script processes messages. The bridge reads it once at init.

---

## MEDIUM

### 2. Weak Message ID Generation (CWE-330)

**File:** `content.js:34`

```javascript
const id = Math.random().toString(36).slice(2);
```

`Math.random()` is not cryptographically secure. An attacker observing response messages (posted with `"*"`) can reconstruct the PRNG state and predict future IDs, enabling reliable response spoofing.

**Fix:**
```javascript
const id = crypto.getRandomValues(new Uint8Array(16))
  .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
```

### 3. No Sender Validation in Service Worker (CWE-284)

**File:** `background.js:61`

`chrome.runtime.onMessage` never checks `sender`. The `RESIZE_WINDOW` handler accepts arbitrary `width`/`height` with no bounds. `OPEN_WINAMP` messages forwarded from MAIN world can spam the popup.

**Fix:**
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.type === "RESIZE_WINDOW") {
    const w = Math.max(200, Math.min(800, message.width));
    const h = Math.max(100, Math.min(600, message.height));
    // use clamped values...
  }
  // ...
});
```

### 4. MAIN-World Bridge Exposes Playback API (CWE-829)

**Files:** `bridge-youtube.js`, `bridge-spotify.js`, `bridge-amazon.js`

All bridges run in `MAIN` world and register `window.addEventListener("message", ...)`. Any page script can use this command channel. This is architectural (required for `#movie_player` access) but should be hardened with the nonce scheme from finding #1.

---

## LOW

### 5. Web-Accessible Resources Enable Extension Fingerprinting (CWE-200)

**File:** `manifest.json:53-62`

`web_accessible_resources` declares `skins/*` accessible to music service origins. Any script on those pages can probe `chrome-extension://<id>/skins/base.wsz` to detect the extension.

Skin files are only loaded from extension pages (winamp.html) which have implicit access to their own resources. The `web_accessible_resources` block is **not needed** and should be removed entirely.

Additionally, the `matches` should be scoped from `<all_urls>` to the three music service origins if the block must be kept for any reason.

### 6. ZIP Processing Without Size Limits (CWE-400)

**File:** `skin-loader.js:249-298`

User-uploaded `.wsz` files have no size cap. A crafted zip bomb could crash the extension page. Risk is low since it requires user interaction and only allowlisted filenames are extracted.

**Fix:**
```javascript
async function loadSkinFromZip(arrayBuffer) {
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
        throw new Error("Skin file too large (max 10MB)");
    }
    const zip = await JSZip.loadAsync(arrayBuffer);
    // ...
}
```

### 7. `innerHTML = ""` Used to Clear Elements (CWE-79)

**File:** `winamp.js:674`

```javascript
plTrackList.innerHTML = "";
```

While clearing with an empty string is not directly exploitable, using `innerHTML` anywhere establishes a risky pattern. Prefer `replaceChildren()` which is safer and more explicit.

**Fix:**
```javascript
plTrackList.replaceChildren();
```

---

## INFO

### 8. Regex from Controlled Input (CWE-1333)

**File:** `skin-loader.js:257`

`findFile()` builds a regex from its parameters, but both are always hardcoded. Not exploitable today; just a pattern to watch if the API ever accepts user input.

---

## CLEAN AREAS

- **No code injection vectors** -- no `eval()`, `new Function()`, `document.write()` anywhere
- **Skin parsing is safe** -- canvas-based sprite extraction, regex-validated colors, `textContent` for CSS
- **No external network requests** -- only fetches local extension resources
- **Minimal permissions** -- only `activeTab` and `tabs`
- **JSZip 3.10.1** -- no known CVEs, vendored locally
- **CSP not set** -- MV3 default CSP is already restrictive for extension pages, but an explicit policy should be added

---

## EXPLOIT CHAIN

The most realistic attack chains findings #1 + #2 + #4:

1. Malicious ad/XSS on `music.youtube.com` observes `YTWINAMP_BRIDGE_RESPONSE` messages (posted with `"*"`)
2. Observes message IDs to reconstruct `Math.random()` state
3. Sends crafted `YTWINAMP_BRIDGE_REQUEST` messages to control playback
4. Races legitimate responses with spoofed data to poison the Winamp UI

**Impact:** Playback manipulation and UI spoofing. No data exfiltration, credential theft, or RCE.

---

## REMEDIATION PRIORITY

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | Add session nonce to postMessage channel (#1, #4) | Medium |
| 2 | Use `crypto.getRandomValues()` for message IDs (#2) | Low |
| 3 | Validate sender in background.js + clamp dimensions (#3) | Low |
| 4 | Remove or scope `web_accessible_resources` (#5) | Trivial |
| 5 | Add explicit CSP to manifest | Trivial |
| 6 | Add skin file size limit (#6) | Low |
| 7 | Replace `innerHTML = ""` with `replaceChildren()` (#7) | Trivial |

---

## MANIFEST SECURITY HARDENING

Add explicit Content Security Policy:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; img-src 'self' blob: data:;"
}
```

Scope web_accessible_resources (or remove entirely):
```json
"web_accessible_resources": [
  {
    "resources": ["skins/*"],
    "matches": [
      "*://music.youtube.com/*",
      "*://open.spotify.com/*",
      "*://music.amazon.com/*"
    ]
  }
]
```
