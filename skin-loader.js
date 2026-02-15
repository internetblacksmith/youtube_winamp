// YouTube Winamp — Skin Loader
// Parses Winamp .wsz skin files (ZIP archives of BMP sprite sheets)
// and generates CSS with data URI backgrounds for each UI element.
// Sprite coordinates sourced from Webamp (github.com/captbaritone/webamp).

(function () {
  "use strict";

  // ── Sprite coordinate map ─────────────────────────────────────────────
  // Maps BMP filenames to arrays of { name, x, y, width, height }
  const SPRITES = {
    MAIN: [
      { name: "MAIN_WINDOW_BACKGROUND", x: 0, y: 0, w: 275, h: 116 },
    ],
    TITLEBAR: [
      { name: "MAIN_TITLE_BAR", x: 27, y: 15, w: 275, h: 14 },
      { name: "MAIN_TITLE_BAR_SELECTED", x: 27, y: 0, w: 275, h: 14 },
      { name: "MAIN_OPTIONS_BUTTON", x: 0, y: 0, w: 9, h: 9 },
      { name: "MAIN_OPTIONS_BUTTON_DEPRESSED", x: 0, y: 9, w: 9, h: 9 },
      { name: "MAIN_MINIMIZE_BUTTON", x: 9, y: 0, w: 9, h: 9 },
      { name: "MAIN_MINIMIZE_BUTTON_DEPRESSED", x: 9, y: 9, w: 9, h: 9 },
      { name: "MAIN_SHADE_BUTTON", x: 0, y: 18, w: 9, h: 9 },
      { name: "MAIN_SHADE_BUTTON_DEPRESSED", x: 9, y: 18, w: 9, h: 9 },
      { name: "MAIN_CLOSE_BUTTON", x: 18, y: 0, w: 9, h: 9 },
      { name: "MAIN_CLOSE_BUTTON_DEPRESSED", x: 18, y: 9, w: 9, h: 9 },
      { name: "MAIN_CLUTTER_BAR_BACKGROUND", x: 304, y: 0, w: 8, h: 43 },
      { name: "MAIN_CLUTTER_BAR_BACKGROUND_DISABLED", x: 312, y: 0, w: 8, h: 43 },
    ],
    CBUTTONS: [
      { name: "MAIN_PREVIOUS_BUTTON", x: 0, y: 0, w: 23, h: 18 },
      { name: "MAIN_PREVIOUS_BUTTON_ACTIVE", x: 0, y: 18, w: 23, h: 18 },
      { name: "MAIN_PLAY_BUTTON", x: 23, y: 0, w: 23, h: 18 },
      { name: "MAIN_PLAY_BUTTON_ACTIVE", x: 23, y: 18, w: 23, h: 18 },
      { name: "MAIN_PAUSE_BUTTON", x: 46, y: 0, w: 23, h: 18 },
      { name: "MAIN_PAUSE_BUTTON_ACTIVE", x: 46, y: 18, w: 23, h: 18 },
      { name: "MAIN_STOP_BUTTON", x: 69, y: 0, w: 23, h: 18 },
      { name: "MAIN_STOP_BUTTON_ACTIVE", x: 69, y: 18, w: 23, h: 18 },
      { name: "MAIN_NEXT_BUTTON", x: 92, y: 0, w: 23, h: 18 },
      { name: "MAIN_NEXT_BUTTON_ACTIVE", x: 92, y: 18, w: 22, h: 18 },
      { name: "MAIN_EJECT_BUTTON", x: 114, y: 0, w: 22, h: 16 },
      { name: "MAIN_EJECT_BUTTON_ACTIVE", x: 114, y: 16, w: 22, h: 16 },
    ],
    SHUFREP: [
      { name: "MAIN_SHUFFLE_BUTTON", x: 28, y: 0, w: 47, h: 15 },
      { name: "MAIN_SHUFFLE_BUTTON_DEPRESSED", x: 28, y: 15, w: 47, h: 15 },
      { name: "MAIN_SHUFFLE_BUTTON_SELECTED", x: 28, y: 30, w: 47, h: 15 },
      { name: "MAIN_SHUFFLE_BUTTON_SELECTED_DEPRESSED", x: 28, y: 45, w: 47, h: 15 },
      { name: "MAIN_REPEAT_BUTTON", x: 0, y: 0, w: 28, h: 15 },
      { name: "MAIN_REPEAT_BUTTON_DEPRESSED", x: 0, y: 15, w: 28, h: 15 },
      { name: "MAIN_REPEAT_BUTTON_SELECTED", x: 0, y: 30, w: 28, h: 15 },
      { name: "MAIN_REPEAT_BUTTON_SELECTED_DEPRESSED", x: 0, y: 45, w: 28, h: 15 },
      { name: "MAIN_EQ_BUTTON", x: 0, y: 61, w: 23, h: 12 },
      { name: "MAIN_EQ_BUTTON_SELECTED", x: 0, y: 73, w: 23, h: 12 },
      { name: "MAIN_EQ_BUTTON_DEPRESSED", x: 46, y: 61, w: 23, h: 12 },
      { name: "MAIN_EQ_BUTTON_DEPRESSED_SELECTED", x: 46, y: 73, w: 23, h: 12 },
      { name: "MAIN_PLAYLIST_BUTTON", x: 23, y: 61, w: 23, h: 12 },
      { name: "MAIN_PLAYLIST_BUTTON_SELECTED", x: 23, y: 73, w: 23, h: 12 },
      { name: "MAIN_PLAYLIST_BUTTON_DEPRESSED", x: 69, y: 61, w: 23, h: 12 },
      { name: "MAIN_PLAYLIST_BUTTON_DEPRESSED_SELECTED", x: 69, y: 73, w: 23, h: 12 },
    ],
    POSBAR: [
      { name: "MAIN_POSITION_SLIDER_BACKGROUND", x: 0, y: 0, w: 248, h: 10 },
      { name: "MAIN_POSITION_SLIDER_THUMB", x: 248, y: 0, w: 29, h: 10 },
      { name: "MAIN_POSITION_SLIDER_THUMB_SELECTED", x: 278, y: 0, w: 29, h: 10 },
    ],
    VOLUME: [
      { name: "MAIN_VOLUME_BACKGROUND", x: 0, y: 0, w: 68, h: 420 },
      { name: "MAIN_VOLUME_THUMB", x: 15, y: 422, w: 14, h: 11 },
      { name: "MAIN_VOLUME_THUMB_SELECTED", x: 0, y: 422, w: 14, h: 11 },
    ],
    BALANCE: [
      { name: "MAIN_BALANCE_BACKGROUND", x: 9, y: 0, w: 38, h: 420 },
      { name: "MAIN_BALANCE_THUMB", x: 15, y: 422, w: 14, h: 11 },
      { name: "MAIN_BALANCE_THUMB_SELECTED", x: 0, y: 422, w: 14, h: 11 },
    ],
    NUMBERS: [
      { name: "DIGIT_0", x: 0, y: 0, w: 9, h: 13 },
      { name: "DIGIT_1", x: 9, y: 0, w: 9, h: 13 },
      { name: "DIGIT_2", x: 18, y: 0, w: 9, h: 13 },
      { name: "DIGIT_3", x: 27, y: 0, w: 9, h: 13 },
      { name: "DIGIT_4", x: 36, y: 0, w: 9, h: 13 },
      { name: "DIGIT_5", x: 45, y: 0, w: 9, h: 13 },
      { name: "DIGIT_6", x: 54, y: 0, w: 9, h: 13 },
      { name: "DIGIT_7", x: 63, y: 0, w: 9, h: 13 },
      { name: "DIGIT_8", x: 72, y: 0, w: 9, h: 13 },
      { name: "DIGIT_9", x: 81, y: 0, w: 9, h: 13 },
      { name: "NO_MINUS_SIGN", x: 9, y: 6, w: 5, h: 1 },
      { name: "MINUS_SIGN", x: 20, y: 6, w: 5, h: 1 },
    ],
    PLAYPAUS: [
      { name: "MAIN_PLAYING_INDICATOR", x: 0, y: 0, w: 9, h: 9 },
      { name: "MAIN_PAUSED_INDICATOR", x: 9, y: 0, w: 9, h: 9 },
      { name: "MAIN_STOPPED_INDICATOR", x: 18, y: 0, w: 9, h: 9 },
      { name: "MAIN_NOT_WORKING_INDICATOR", x: 36, y: 0, w: 9, h: 9 },
      { name: "MAIN_WORKING_INDICATOR", x: 39, y: 0, w: 9, h: 9 },
    ],
    MONOSTER: [
      { name: "MAIN_STEREO", x: 0, y: 12, w: 29, h: 12 },
      { name: "MAIN_STEREO_SELECTED", x: 0, y: 0, w: 29, h: 12 },
      { name: "MAIN_MONO", x: 29, y: 12, w: 27, h: 12 },
      { name: "MAIN_MONO_SELECTED", x: 29, y: 0, w: 27, h: 12 },
    ],
    EQMAIN: [
      { name: "EQ_WINDOW_BACKGROUND", x: 0, y: 0, w: 275, h: 116 },
      { name: "EQ_TITLE_BAR_SELECTED", x: 0, y: 134, w: 275, h: 14 },
      { name: "EQ_TITLE_BAR", x: 0, y: 149, w: 275, h: 14 },
      { name: "EQ_CLOSE_BUTTON", x: 0, y: 116, w: 9, h: 9 },
      { name: "EQ_CLOSE_BUTTON_DEPRESSED", x: 0, y: 125, w: 9, h: 9 },
      // ON button: off, off-pressed, on, on-pressed
      { name: "EQ_ON_BUTTON", x: 10, y: 119, w: 26, h: 12 },
      { name: "EQ_ON_BUTTON_DEPRESSED", x: 128, y: 119, w: 26, h: 12 },
      { name: "EQ_ON_BUTTON_SELECTED", x: 69, y: 119, w: 26, h: 12 },
      { name: "EQ_ON_BUTTON_SELECTED_DEPRESSED", x: 187, y: 119, w: 26, h: 12 },
      // AUTO button: off, off-pressed, on, on-pressed
      { name: "EQ_AUTO_BUTTON", x: 36, y: 119, w: 33, h: 12 },
      { name: "EQ_AUTO_BUTTON_DEPRESSED", x: 154, y: 119, w: 33, h: 12 },
      { name: "EQ_AUTO_BUTTON_SELECTED", x: 95, y: 119, w: 33, h: 12 },
      { name: "EQ_AUTO_BUTTON_SELECTED_DEPRESSED", x: 213, y: 119, w: 33, h: 12 },
      // Presets button
      { name: "EQ_PRESETS_BUTTON", x: 224, y: 164, w: 44, h: 12 },
      { name: "EQ_PRESETS_BUTTON_DEPRESSED", x: 224, y: 176, w: 44, h: 12 },
      // Slider bar backgrounds — 28 frames in a 14×2 grid, each 15×65
      { name: "EQ_SLIDER_BACKGROUND", x: 13, y: 164, w: 209, h: 129 },
      // Slider thumb
      { name: "EQ_SLIDER_THUMB", x: 0, y: 164, w: 11, h: 11 },
      { name: "EQ_SLIDER_THUMB_SELECTED", x: 0, y: 176, w: 11, h: 11 },
      // Graph background
      { name: "EQ_GRAPH_BACKGROUND", x: 0, y: 294, w: 113, h: 19 },
    ],
    PLEDIT: [
      // Title bar — selected (active)
      { name: "PLAYLIST_TOP_LEFT_SELECTED", x: 0, y: 0, w: 25, h: 20 },
      { name: "PLAYLIST_TITLE_BAR_SELECTED", x: 26, y: 0, w: 100, h: 20 },
      { name: "PLAYLIST_TOP_TILE_SELECTED", x: 127, y: 0, w: 25, h: 20 },
      { name: "PLAYLIST_TOP_RIGHT_CORNER_SELECTED", x: 153, y: 0, w: 25, h: 20 },
      // Title bar — unselected (inactive)
      { name: "PLAYLIST_TOP_LEFT_CORNER", x: 0, y: 21, w: 25, h: 20 },
      { name: "PLAYLIST_TITLE_BAR", x: 26, y: 21, w: 100, h: 20 },
      { name: "PLAYLIST_TOP_TILE", x: 127, y: 21, w: 25, h: 20 },
      { name: "PLAYLIST_TOP_RIGHT_CORNER", x: 153, y: 21, w: 25, h: 20 },
      // Borders
      { name: "PLAYLIST_LEFT_TILE", x: 0, y: 42, w: 12, h: 29 },
      { name: "PLAYLIST_RIGHT_TILE", x: 31, y: 42, w: 20, h: 29 },
      // Scrollbar
      { name: "PLAYLIST_SCROLL_HANDLE", x: 52, y: 53, w: 8, h: 18 },
      { name: "PLAYLIST_SCROLL_HANDLE_SELECTED", x: 61, y: 53, w: 8, h: 18 },
      // Close / Collapse buttons
      { name: "PLAYLIST_CLOSE_SELECTED", x: 52, y: 42, w: 9, h: 9 },
      { name: "PLAYLIST_COLLAPSE_SELECTED", x: 62, y: 42, w: 9, h: 9 },
      // Bottom bar
      { name: "PLAYLIST_BOTTOM_LEFT_CORNER", x: 0, y: 72, w: 125, h: 38 },
      { name: "PLAYLIST_BOTTOM_RIGHT_CORNER", x: 126, y: 72, w: 150, h: 38 },
      { name: "PLAYLIST_BOTTOM_TILE", x: 179, y: 0, w: 25, h: 38 },
    ],
    TEXT: null, // Generated dynamically below
  };

  // ── TEXT.BMP character map ────────────────────────────────────────────
  // Characters are 5×6 pixels, laid out in rows
  const CHAR_W = 5;
  const CHAR_H = 6;
  const FONT_LOOKUP = {
    a:[0,0],b:[0,1],c:[0,2],d:[0,3],e:[0,4],f:[0,5],g:[0,6],h:[0,7],
    i:[0,8],j:[0,9],k:[0,10],l:[0,11],m:[0,12],n:[0,13],o:[0,14],p:[0,15],
    q:[0,16],r:[0,17],s:[0,18],t:[0,19],u:[0,20],v:[0,21],w:[0,22],x:[0,23],
    y:[0,24],z:[0,25],'"':[0,26],"@":[0,27]," ":[0,30],
    "0":[1,0],"1":[1,1],"2":[1,2],"3":[1,3],"4":[1,4],"5":[1,5],
    "6":[1,6],"7":[1,7],"8":[1,8],"9":[1,9],".":[1,11],":":[1,12],
    "(":[1,13],")":[1,14],"-":[1,15],"'":[1,16],"!":[1,17],"_":[1,18],
    "+":[1,19],"\\":[1,20],"/":[1,21],"[":[1,22],"]":[1,23],"^":[1,24],
    "&":[1,25],"%":[1,26],",":[1,27],"=":[1,28],"$":[1,29],"#":[1,30],
    "?":[2,3],"*":[2,4],
  };

  // Generate TEXT sprite definitions
  const textSprites = [];
  for (const key in FONT_LOOKUP) {
    const pos = FONT_LOOKUP[key];
    textSprites.push({
      name: "CHARACTER_" + key.charCodeAt(0),
      x: pos[1] * CHAR_W,
      y: pos[0] * CHAR_H,
      w: CHAR_W,
      h: CHAR_H,
    });
  }
  SPRITES.TEXT = textSprites;

  // ── Image loading helpers ─────────────────────────────────────────────
  function imgFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  }

  function spriteToDataURI(img, sprite) {
    const canvas = document.createElement("canvas");
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, -sprite.x, -sprite.y);
    return canvas.toDataURL();
  }

  function extractSprites(img, sprites) {
    const result = {};
    for (const sprite of sprites) {
      result[sprite.name] = spriteToDataURI(img, sprite);
    }
    return result;
  }

  // ── Parse VISCOLOR.TXT ────────────────────────────────────────────────
  function parseViscolors(text) {
    const lines = text.split("\n");
    const colors = [];
    for (let i = 0; i < Math.min(lines.length, 24); i++) {
      const match = lines[i].match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (match) {
        colors.push(`rgb(${match[1]},${match[2]},${match[3]})`);
      }
    }
    return colors.length >= 24 ? colors : null;
  }

  // ── Parse PLEDIT.TXT ─────────────────────────────────────────────────
  function parsePleditTxt(text) {
    const colors = {
      normal: "#FF8924",
      current: "#FFFF00",
      normalbg: "#1A120A",
      selectedbg: "#944E11",
    };
    const lines = text.split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*(Normal|Current|NormalBG|SelectedBG)\s*=\s*(#[0-9A-Fa-f]{6})/i);
      if (m) {
        colors[m[1].toLowerCase()] = m[2];
      }
    }
    return colors;
  }

  // ── Load skin from .wsz (ZIP) ────────────────────────────────────────
  async function loadSkinFromZip(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const images = {};
    let visColors = null;
    let pleditColors = null;

    // Helper to find file in zip (case-insensitive)
    function findFile(name, ext) {
      const regex = new RegExp(`^(.*[/\\\\])?${name}\\.(${ext})$`, "i");
      const files = zip.file(regex);
      return files.length ? files[files.length - 1] : null;
    }

    // Extract sprite images from each BMP/PNG sheet
    for (const fileName of Object.keys(SPRITES)) {
      if (!SPRITES[fileName]) continue;
      const file = findFile(fileName, "png|bmp");
      if (!file) continue;

      try {
        const blob = await file.async("blob");
        const ext = file.name.split(".").pop().toLowerCase();
        const typedBlob = new Blob([blob], { type: `image/${ext === "bmp" ? "bmp" : "png"}` });
        const img = await imgFromBlob(typedBlob);
        const sprites = extractSprites(img, SPRITES[fileName]);
        Object.assign(images, sprites);
      } catch (e) {
        console.warn(`Failed to parse ${fileName}:`, e);
      }
    }

    // Parse VISCOLOR.TXT for visualizer colors
    const visFile = findFile("VISCOLOR", "txt");
    if (visFile) {
      try {
        const text = await visFile.async("text");
        visColors = parseViscolors(text);
      } catch (_e) { /* ignore */ }
    }

    // Parse PLEDIT.TXT for playlist editor colors
    const pleditFile = findFile("PLEDIT", "txt");
    if (pleditFile) {
      try {
        const text = await pleditFile.async("text");
        pleditColors = parsePleditTxt(text);
      } catch (_e) { /* ignore */ }
    }

    return { images, visColors, pleditColors };
  }

  // ── Generate volume/balance frame CSS ─────────────────────────────────
  // Volume has 28 frames (68×13 each) stacked vertically = 68×420 total
  // Balance has 28 frames (38×13 each) stacked vertically = 38×420
  // We use background-position to show the right frame based on value.

  // ── Apply skin to DOM ─────────────────────────────────────────────────
  function applySkin(skinData) {
    const imgs = skinData.images;
    let css = "";

    function rule(selector, spriteName) {
      if (imgs[spriteName]) {
        css += `${selector} { background-image: url("${imgs[spriteName]}"); background-size: contain; background-repeat: no-repeat; }\n`;
      }
    }

    function ruleSize(selector, spriteName, w, h) {
      if (imgs[spriteName]) {
        css += `${selector} { background-image: url("${imgs[spriteName]}"); background-size: ${w}px ${h}px; background-repeat: no-repeat; }\n`;
      }
    }

    // Main window background
    rule("#winamp", "MAIN_WINDOW_BACKGROUND");

    // Titlebar
    rule("#title-bar", "MAIN_TITLE_BAR_SELECTED");
    rule(".winamp.inactive #title-bar", "MAIN_TITLE_BAR");

    // Titlebar buttons
    rule("#btn-minimize", "MAIN_MINIMIZE_BUTTON");
    rule("#btn-minimize:active", "MAIN_MINIMIZE_BUTTON_DEPRESSED");
    rule("#btn-shade", "MAIN_SHADE_BUTTON");
    rule("#btn-shade:active", "MAIN_SHADE_BUTTON_DEPRESSED");
    rule("#btn-close", "MAIN_CLOSE_BUTTON");
    rule("#btn-close:active", "MAIN_CLOSE_BUTTON_DEPRESSED");

    // Clutter bar
    rule("#clutter-bar", "MAIN_CLUTTER_BAR_BACKGROUND");

    // Status indicators (play/pause/stop)
    rule("#play-pause.playing", "MAIN_PLAYING_INDICATOR");
    rule("#play-pause.paused", "MAIN_PAUSED_INDICATOR");
    rule("#play-pause.stopped", "MAIN_STOPPED_INDICATOR");

    // Time digits
    for (let d = 0; d <= 9; d++) {
      rule(`.digit-${d}`, `DIGIT_${d}`);
    }
    rule("#minus-sign.hidden", "NO_MINUS_SIGN");
    rule("#minus-sign.visible", "MINUS_SIGN");

    // Mono/Stereo
    rule("#mono", "MAIN_MONO");
    rule("#mono.active", "MAIN_MONO_SELECTED");
    rule("#stereo", "MAIN_STEREO");
    rule("#stereo.active", "MAIN_STEREO_SELECTED");

    // Volume - use the full background image, offset by value
    if (imgs["MAIN_VOLUME_BACKGROUND"]) {
      css += `#volume { background-image: url("${imgs["MAIN_VOLUME_BACKGROUND"]}"); background-repeat: no-repeat; background-size: 68px auto; }\n`;
    }
    rule("#volume input::-webkit-slider-thumb", "MAIN_VOLUME_THUMB");
    rule("#volume input:active::-webkit-slider-thumb", "MAIN_VOLUME_THUMB_SELECTED");

    // Balance
    if (imgs["MAIN_BALANCE_BACKGROUND"]) {
      css += `#balance { background-image: url("${imgs["MAIN_BALANCE_BACKGROUND"]}"); background-repeat: no-repeat; background-size: 38px auto; }\n`;
    }
    rule("#balance input::-webkit-slider-thumb", "MAIN_BALANCE_THUMB");
    rule("#balance input:active::-webkit-slider-thumb", "MAIN_BALANCE_THUMB_SELECTED");

    // EQ / PL buttons
    rule("#btn-eq", "MAIN_EQ_BUTTON");
    rule("#btn-eq:active", "MAIN_EQ_BUTTON_DEPRESSED");
    rule("#btn-eq.active", "MAIN_EQ_BUTTON_SELECTED");
    rule("#btn-eq.active:active", "MAIN_EQ_BUTTON_DEPRESSED_SELECTED");
    rule("#btn-pl", "MAIN_PLAYLIST_BUTTON");
    rule("#btn-pl:active", "MAIN_PLAYLIST_BUTTON_DEPRESSED");
    rule("#btn-pl.active", "MAIN_PLAYLIST_BUTTON_SELECTED");
    rule("#btn-pl.active:active", "MAIN_PLAYLIST_BUTTON_DEPRESSED_SELECTED");

    // Position/seek bar
    rule("#position", "MAIN_POSITION_SLIDER_BACKGROUND");
    rule("#position input::-webkit-slider-thumb", "MAIN_POSITION_SLIDER_THUMB");
    rule("#position input:active::-webkit-slider-thumb", "MAIN_POSITION_SLIDER_THUMB_SELECTED");

    // Transport buttons
    rule("#btn-prev", "MAIN_PREVIOUS_BUTTON");
    rule("#btn-prev:active", "MAIN_PREVIOUS_BUTTON_ACTIVE");
    rule("#btn-play", "MAIN_PLAY_BUTTON");
    rule("#btn-play:active", "MAIN_PLAY_BUTTON_ACTIVE");
    rule("#btn-pause", "MAIN_PAUSE_BUTTON");
    rule("#btn-pause:active", "MAIN_PAUSE_BUTTON_ACTIVE");
    rule("#btn-stop", "MAIN_STOP_BUTTON");
    rule("#btn-stop:active", "MAIN_STOP_BUTTON_ACTIVE");
    rule("#btn-next", "MAIN_NEXT_BUTTON");
    rule("#btn-next:active", "MAIN_NEXT_BUTTON_ACTIVE");
    rule("#btn-eject", "MAIN_EJECT_BUTTON");
    rule("#btn-eject:active", "MAIN_EJECT_BUTTON_ACTIVE");

    // Shuffle / Repeat
    rule("#btn-shuffle", "MAIN_SHUFFLE_BUTTON");
    rule("#btn-shuffle:active", "MAIN_SHUFFLE_BUTTON_DEPRESSED");
    rule("#btn-shuffle.active", "MAIN_SHUFFLE_BUTTON_SELECTED");
    rule("#btn-shuffle.active:active", "MAIN_SHUFFLE_BUTTON_SELECTED_DEPRESSED");
    rule("#btn-repeat", "MAIN_REPEAT_BUTTON");
    rule("#btn-repeat:active", "MAIN_REPEAT_BUTTON_DEPRESSED");
    rule("#btn-repeat.active", "MAIN_REPEAT_BUTTON_SELECTED");
    rule("#btn-repeat.active:active", "MAIN_REPEAT_BUTTON_SELECTED_DEPRESSED");

    // ═══ PLAYLIST EDITOR ═══
    // Title bar — active
    rule("#pl-title-left", "PLAYLIST_TOP_LEFT_SELECTED");
    rule("#pl-title-stretch", "PLAYLIST_TITLE_BAR_SELECTED");
    rule("#pl-title-right", "PLAYLIST_TOP_RIGHT_CORNER_SELECTED");
    // Title bar — inactive
    rule(".playlist-window.inactive #pl-title-left", "PLAYLIST_TOP_LEFT_CORNER");
    rule(".playlist-window.inactive #pl-title-stretch", "PLAYLIST_TITLE_BAR");
    rule(".playlist-window.inactive #pl-title-right", "PLAYLIST_TOP_RIGHT_CORNER");
    // Title bar tile filler
    if (imgs["PLAYLIST_TOP_TILE_SELECTED"]) {
      css += `#pl-title-stretch { background-image: url("${imgs["PLAYLIST_TOP_TILE_SELECTED"]}"); background-repeat: repeat-x; background-size: auto 20px; }\n`;
    }
    if (imgs["PLAYLIST_TOP_TILE"]) {
      css += `.playlist-window.inactive #pl-title-stretch { background-image: url("${imgs["PLAYLIST_TOP_TILE"]}"); background-repeat: repeat-x; background-size: auto 20px; }\n`;
    }
    // Close / collapse buttons
    rule("#pl-btn-close:active", "PLAYLIST_CLOSE_SELECTED");
    rule("#pl-btn-collapse:active", "PLAYLIST_COLLAPSE_SELECTED");
    // Left/right borders (tiled vertically)
    if (imgs["PLAYLIST_LEFT_TILE"]) {
      css += `#pl-left-border { background-image: url("${imgs["PLAYLIST_LEFT_TILE"]}"); background-repeat: repeat-y; background-size: 12px auto; }\n`;
    }
    if (imgs["PLAYLIST_RIGHT_TILE"]) {
      css += `#pl-right-border { background-image: url("${imgs["PLAYLIST_RIGHT_TILE"]}"); background-repeat: repeat-y; background-size: 20px auto; }\n`;
    }
    // Scrollbar handle
    rule("#pl-scroll-handle", "PLAYLIST_SCROLL_HANDLE");
    rule("#pl-scroll-handle.active", "PLAYLIST_SCROLL_HANDLE_SELECTED");
    // Bottom bar
    rule("#pl-bottom-left", "PLAYLIST_BOTTOM_LEFT_CORNER");
    rule("#pl-bottom-right", "PLAYLIST_BOTTOM_RIGHT_CORNER");
    if (imgs["PLAYLIST_BOTTOM_TILE"]) {
      css += `#pl-bottom-tile { background-image: url("${imgs["PLAYLIST_BOTTOM_TILE"]}"); background-repeat: repeat-x; background-size: auto 38px; }\n`;
    }

    // ═══ EQUALIZER ═══
    ruleSize("#eq-window", "EQ_WINDOW_BACKGROUND", 275, 116);
    rule("#eq-title-bar", "EQ_TITLE_BAR_SELECTED");
    rule(".eq-window.inactive #eq-title-bar", "EQ_TITLE_BAR");
    rule("#eq-btn-close", "EQ_CLOSE_BUTTON");
    rule("#eq-btn-close:active", "EQ_CLOSE_BUTTON_DEPRESSED");
    // ON button — 4 states
    rule("#eq-btn-on", "EQ_ON_BUTTON");
    rule("#eq-btn-on:active", "EQ_ON_BUTTON_DEPRESSED");
    rule("#eq-btn-on.active", "EQ_ON_BUTTON_SELECTED");
    rule("#eq-btn-on.active:active", "EQ_ON_BUTTON_SELECTED_DEPRESSED");
    // AUTO button — 4 states
    rule("#eq-btn-auto", "EQ_AUTO_BUTTON");
    rule("#eq-btn-auto:active", "EQ_AUTO_BUTTON_DEPRESSED");
    rule("#eq-btn-auto.active", "EQ_AUTO_BUTTON_SELECTED");
    rule("#eq-btn-auto.active:active", "EQ_AUTO_BUTTON_SELECTED_DEPRESSED");
    // Presets
    rule("#eq-btn-presets", "EQ_PRESETS_BUTTON");
    rule("#eq-btn-presets:active", "EQ_PRESETS_BUTTON_DEPRESSED");
    // Slider thumbs
    rule(".eq-slider-thumb", "EQ_SLIDER_THUMB");
    rule(".eq-slider-thumb.active", "EQ_SLIDER_THUMB_SELECTED");
    // Graph
    rule("#eq-graph", "EQ_GRAPH_BACKGROUND");

    // PLEDIT.TXT colors
    const plc = skinData.pleditColors || { normal: "#FF8924", current: "#FFFF00", normalbg: "#1A120A", selectedbg: "#944E11" };
    css += `#pl-track-list { background-color: ${plc.normalbg}; }\n`;
    css += `.pl-track { color: ${plc.normal}; }\n`;
    css += `.pl-track.pl-current { color: ${plc.current}; }\n`;
    css += `.pl-track.pl-selected { background-color: ${plc.selectedbg}; }\n`;

    // Inject CSS
    let styleEl = document.getElementById("winamp-skin-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "winamp-skin-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;

    // Store character sprites for marquee rendering
    window._skinCharacters = {};
    for (const key in FONT_LOOKUP) {
      const code = key.charCodeAt(0);
      const spriteName = "CHARACTER_" + code;
      if (imgs[spriteName]) {
        window._skinCharacters[key.toLowerCase()] = imgs[spriteName];
      }
    }

    // Apply EQ backgrounds directly to DOM (more reliable than CSS cascade)
    const eqWindowEl = document.getElementById("eq-window");
    if (eqWindowEl && imgs["EQ_WINDOW_BACKGROUND"]) {
      eqWindowEl.style.backgroundImage = `url("${imgs["EQ_WINDOW_BACKGROUND"]}")`;
    }

    // Store EQ slider bar sprite sheet and apply to all tracks immediately
    window._eqSliderBg = imgs["EQ_SLIDER_BACKGROUND"] || null;
    if (window._eqSliderBg) {
      document.querySelectorAll(".eq-slider-thumb").forEach((thumb) => {
        const track = thumb.parentElement;
        const maxTop = 52; // 63 - 11
        const top = parseFloat(thumb.style.top);
        const t = isNaN(top) ? 26 : top;
        const frame = Math.round((1 - t / maxTop) * 27);
        const col = frame % 14;
        const row = Math.floor(frame / 14);
        track.style.backgroundImage = `url("${window._eqSliderBg}")`;
        track.style.backgroundSize = "209px 129px";
        track.style.backgroundPosition = `-${col * 15}px -${row * 65}px`;
      });
    }

    // Store vis colors
    window._skinVisColors = skinData.visColors;

    // Store pledit colors
    window._skinPleditColors = skinData.pleditColors;

    return skinData;
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.SkinLoader = {
    loadFromZip: loadSkinFromZip,
    apply: applySkin,
    CHAR_W,
    CHAR_H,
    FONT_LOOKUP,

    async loadAndApply(url) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const skinData = await loadSkinFromZip(buffer);
      return applySkin(skinData);
    },

    async loadFromFile(file) {
      const buffer = await file.arrayBuffer();
      const skinData = await loadSkinFromZip(buffer);
      return applySkin(skinData);
    }
  };
})();
