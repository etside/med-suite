/**
 * Medsuite-eT — Electron Preload Script
 * Minimal preload — contextIsolation is enabled.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
});
