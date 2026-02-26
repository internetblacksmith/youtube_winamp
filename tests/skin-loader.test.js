const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadIIFE } = require("./helpers/iife-loader");

// Load skin-loader.js in a sandbox, exposing internal functions
const win = loadIIFE("skin-loader.js", {
  expose: ["parseViscolors", "parsePleditTxt"],
});
const { parseViscolors, parsePleditTxt } = win.__internals;

// ── parseViscolors ──────────────────────────────────────────────────────

describe("parseViscolors", () => {
  it("parses a valid 24-line VISCOLOR.TXT", () => {
    const lines = [];
    for (let i = 0; i < 24; i++) {
      lines.push(`${i * 10}, ${i * 5}, ${255 - i}`);
    }
    const result = parseViscolors(lines.join("\n"));
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 24);
    assert.equal(result[0], "rgb(0,0,255)");
    assert.equal(result[23], "rgb(230,115,232)");
  });

  it("returns null when fewer than 24 valid lines", () => {
    const lines = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`${i}, ${i}, ${i}`);
    }
    assert.equal(parseViscolors(lines.join("\n")), null);
  });

  it("handles comments/extra text after RGB values", () => {
    const lines = [];
    for (let i = 0; i < 24; i++) {
      lines.push(`${i}, ${i}, ${i}, // color ${i}`);
    }
    const result = parseViscolors(lines.join("\n"));
    assert.ok(result);
    assert.equal(result.length, 24);
    assert.equal(result[0], "rgb(0,0,0)");
  });

  it("returns null for empty string", () => {
    assert.equal(parseViscolors(""), null);
  });

  it("ignores lines beyond the first 24", () => {
    const lines = [];
    for (let i = 0; i < 30; i++) {
      lines.push(`${i}, ${i}, ${i}`);
    }
    const result = parseViscolors(lines.join("\n"));
    assert.ok(result);
    assert.equal(result.length, 24);
  });
});

// ── parsePleditTxt ──────────────────────────────────────────────────────

describe("parsePleditTxt", () => {
  it("parses all 4 keys", () => {
    const text = [
      "[Text]",
      "Normal=#00FF00",
      "Current=#FF0000",
      "NormalBG=#000000",
      "SelectedBG=#0000FF",
    ].join("\n");
    const result = { ...parsePleditTxt(text) };
    assert.deepEqual(result, {
      normal: "#00FF00",
      current: "#FF0000",
      normalbg: "#000000",
      selectedbg: "#0000FF",
    });
  });

  it("returns defaults when keys are missing", () => {
    assert.deepEqual({ ...parsePleditTxt("") }, {
      normal: "#FF8924",
      current: "#FFFF00",
      normalbg: "#1A120A",
      selectedbg: "#944E11",
    });
  });

  it("is case-insensitive on key names", () => {
    const text = "normal=#AABBCC\ncurrent=#112233";
    const result = parsePleditTxt(text);
    assert.equal(result.normal, "#AABBCC");
    assert.equal(result.current, "#112233");
  });

  it("keeps defaults for partial input", () => {
    const text = "Normal=#111111";
    const result = parsePleditTxt(text);
    assert.equal(result.normal, "#111111");
    // others remain default
    assert.equal(result.current, "#FFFF00");
    assert.equal(result.normalbg, "#1A120A");
    assert.equal(result.selectedbg, "#944E11");
  });
});
