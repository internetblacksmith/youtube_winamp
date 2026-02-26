// Loads an IIFE-wrapped source file in a Node.js VM sandbox,
// providing mock browser globals so it doesn't throw.
// Returns the sandbox's `window` object for tests to inspect.

const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

/**
 * @param {string} filePath  – absolute or relative-to-project-root path
 * @param {object} [opts]
 * @param {string[]} [opts.expose] – internal function names to hoist onto
 *   `window.__internals` before the IIFE closes (for testing private fns)
 * @returns {object} the sandbox's `window`
 */
function loadIIFE(filePath, opts = {}) {
  const resolved = path.resolve(__dirname, "../..", filePath);
  let source = fs.readFileSync(resolved, "utf-8");

  // If caller wants to expose IIFE-internal functions, inject an assignment
  // just before the closing `})();` so they land on window.__internals.
  if (opts.expose && opts.expose.length) {
    const names = opts.expose.join(", ");
    const injection = `; window.__internals = { ${names} };`;
    // Replace the LAST occurrence of `})();` (handles trailing whitespace too)
    const idx = source.lastIndexOf("})();");
    if (idx === -1) {
      throw new Error(`Could not find closing })(); in ${filePath}`);
    }
    source = source.slice(0, idx) + injection + "\n" + source.slice(idx);
  }

  // Minimal stubs for browser globals
  const window = {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
    navigator: { mediaSession: {} },
    setInterval() {},
    clearInterval() {},
    setTimeout() {},
    clearTimeout() {},
  };

  const document = {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement(tag) {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext() {
            return {
              drawImage() {},
              getImageData() { return { data: new Uint8ClampedArray(0) }; },
              putImageData() {},
              clearRect() {},
              fillRect() {},
              fillText() {},
              measureText() { return { width: 0 }; },
              createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
            };
          },
          toDataURL() { return "data:image/png;base64,"; },
        };
      }
      return { style: {}, appendChild() {}, setAttribute() {} };
    },
    addEventListener() {},
    head: { appendChild() {} },
  };

  const chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
      getURL(p) { return p; },
    },
    storage: {
      local: {
        get(keys, cb) { if (cb) cb({}); return Promise.resolve({}); },
        set(obj, cb) { if (cb) cb(); return Promise.resolve(); },
      },
      onChanged: { addListener() {} },
    },
  };

  const sandbox = {
    window,
    document,
    chrome,
    console,
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:mock"; } },
    Image: class Image {
      set src(_) { if (this.onload) this.onload(); }
    },
    AudioContext: class AudioContext {
      createMediaElementSource() { return { connect() {} }; }
      createAnalyser() { return { fftSize: 0, frequencyBinCount: 0, getByteFrequencyData() {} }; }
      get destination() { return {}; }
    },
    fetch() { return Promise.resolve({ arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); } }); },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
    setInterval: window.setInterval,
    setTimeout: window.setTimeout,
    clearInterval: window.clearInterval,
    clearTimeout: window.clearTimeout,
  };

  // window should also be the global reference
  sandbox.window = Object.assign(sandbox.window, sandbox);

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: filePath });

  return sandbox.window;
}

module.exports = { loadIIFE };
