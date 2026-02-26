const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// parseTime is identical in bridge-spotify.js:9 and bridge-amazon.js:10.
// It's a tiny pure function, so we inline it here instead of loading the
// full IIFE (which has heavy DOM dependencies).
function parseTime(str) {
  if (!str) return 0;
  var parts = str.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

describe("parseTime", () => {
  it("parses M:SS", () => {
    assert.equal(parseTime("3:45"), 225);
  });

  it("parses H:MM:SS", () => {
    assert.equal(parseTime("1:02:30"), 3750);
  });

  it("parses 0:00 to 0", () => {
    assert.equal(parseTime("0:00"), 0);
  });

  it("returns 0 for empty string", () => {
    assert.equal(parseTime(""), 0);
  });

  it("returns 0 for null", () => {
    assert.equal(parseTime(null), 0);
  });

  it("returns 0 for undefined", () => {
    assert.equal(parseTime(undefined), 0);
  });

  it("handles surrounding whitespace", () => {
    assert.equal(parseTime(" 3:45 "), 225);
  });

  it("parses larger values", () => {
    assert.equal(parseTime("10:00"), 600);
    assert.equal(parseTime("2:30:00"), 9000);
  });
});
