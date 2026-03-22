const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Session ──────────────────────────────────────────────────────────────
  loadSession:    ()       => ipcRenderer.invoke('session:load'),
  saveSession:    (data)   => ipcRenderer.invoke('session:save', data),
  clearSession:   ()       => ipcRenderer.invoke('session:clear'),

  // ── Fetch timestamps ─────────────────────────────────────────────────────
  loadTimestamps: ()       => ipcRenderer.invoke('timestamps:load'),
  saveTimestamps: (data)   => ipcRenderer.invoke('timestamps:save', data),

  // ── Presenter sync ───────────────────────────────────────────────────────
  loadPresenter:     ()       => ipcRenderer.invoke('presenter:load'),
  openPresenter:     ()       => ipcRenderer.invoke('presenter:open'),
  pushPresenter:     (data)   => ipcRenderer.send('presenter:push', data),
  onPresenterUpdate: (cb)     => {
    ipcRenderer.on('presenter:update', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('presenter:update');
  },

  // ── Picklist auto-save → ../data/ folder ─────────────────────────────────
  autosavePicklist: ({ eventCode, payload }) =>
    ipcRenderer.invoke('picklist:autosave', { eventCode, payload }),

  // ── Folder watcher: receive files dropped into ../data/ ──────────────────
  onWatcherFile: (cb) => {
    ipcRenderer.on('watcher:file', (_, fileData) => cb(fileData));
    return () => ipcRenderer.removeAllListeners('watcher:file');
  },

  // ── File export (native Save dialog) ─────────────────────────────────────
  exportFile: ({ defaultName, content, filterName, ext }) =>
    ipcRenderer.invoke('export:save', { defaultName, content, filterName, ext }),

  // ── File import (native Open dialog) ─────────────────────────────────────
  importFiles: (filters) =>
    ipcRenderer.invoke('import:open', { filters }),

  // ── Open URL in system browser (avoids YouTube Error 153 in Electron) ────
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ── Misc ──────────────────────────────────────────────────────────────────
  getDataDir:    () => ipcRenderer.invoke('app:dataDir'),
  openDataDir:   () => ipcRenderer.invoke('app:openDataDir'),
});