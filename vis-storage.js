// YouTube Winamp — Visualizer Storage
// Persists custom visualizer scripts and mini-vis mode in chrome.storage.local

(function () {
  "use strict";

  async function getLibrary() {
    const result = await chrome.storage.local.get("visLibrary");
    return result.visLibrary || {};
  }

  async function setLibrary(library) {
    await chrome.storage.local.set({ visLibrary: library });
  }

  window.VisStorage = {
    /**
     * Save or update a custom visualizer script.
     * @param {string} name
     * @param {string} code - Body of the render function
     * @param {string} [existingId] - If provided, updates existing entry
     * @returns {Promise<object>} The saved entry
     */
    async save(name, code, existingId) {
      const library = await getLibrary();
      const id = existingId || ("vis_" + Date.now());
      const existing = library[id];
      library[id] = {
        id,
        name,
        code,
        addedAt: existing ? existing.addedAt : Date.now()
      };
      await setLibrary(library);
      return library[id];
    },

    /**
     * Get a visualizer by ID.
     * @param {string} visId
     * @returns {Promise<object|null>}
     */
    async getById(visId) {
      const library = await getLibrary();
      return library[visId] || null;
    },

    /**
     * List all visualizers sorted by addedAt.
     * @returns {Promise<object[]>}
     */
    async list() {
      const library = await getLibrary();
      return Object.values(library).sort((a, b) => a.addedAt - b.addedAt);
    },

    /**
     * Delete a visualizer. Resets activeVisPreset if it was the deleted one.
     * @param {string} visId
     */
    async delete(visId) {
      const library = await getLibrary();
      delete library[visId];
      await setLibrary(library);
      const active = await this.getActivePreset();
      if (active === visId) {
        await this.setActivePreset(null);
      }
    },

    /**
     * Get the active custom vis preset ID.
     * @returns {Promise<string|null>}
     */
    async getActivePreset() {
      const result = await chrome.storage.local.get("activeVisPreset");
      return result.activeVisPreset || null;
    },

    /**
     * Set the active custom vis preset ID.
     * @param {string|null} visId
     */
    async setActivePreset(visId) {
      await chrome.storage.local.set({ activeVisPreset: visId });
    },

    /**
     * Get the mini-vis mode ("spectrum" | "oscilloscope" | "off").
     * @returns {Promise<string>}
     */
    async getMiniVisMode() {
      const result = await chrome.storage.local.get("miniVisMode");
      return result.miniVisMode || "spectrum";
    },

    /**
     * Set the mini-vis mode.
     * @param {string} mode - "spectrum" | "oscilloscope" | "off"
     */
    async setMiniVisMode(mode) {
      await chrome.storage.local.set({ miniVisMode: mode });
    }
  };
})();
