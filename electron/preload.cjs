/**
 * Medsuite-eT — Electron Preload Script
 * Minimal preload — contextIsolation is enabled.
 * Reads the API base passed by the main process via additionalArguments
 * and exposes it to the renderer before React initializes.
 */
const { contextBridge } = require('electron');

const apiBaseArg = process.argv.find((a) => a.startsWith('--medsuite-api-base='));
const apiBase = apiBaseArg ? apiBaseArg.split('=').slice(1).join('=') : '';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
});

// Expose API base on window so src/lib/api.ts can pick it up.
contextBridge.exposeInMainWorld('__MEDSUITE_API_BASE__', apiBase);
