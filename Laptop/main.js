const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
//  PATHS
//
//  App lives in:   .../Final Scouting/laptop/
//  Data folder:    .../Final Scouting/data/
//
//  __dirname  =  the folder main.js is in  (laptop/)
//  DATA_DIR   =  ../data/  relative to that
// ══════════════════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'data');

// Internal app state dir (session, presenter sync — not user-facing)
function getAppStateDir() {
  const dir = path.join(app.getPath('userData'), 'frc-strategy');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Ensure the shared data folder exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

// ── Path helpers ──────────────────────────────────────────────────────────────
function getSessionPath()    { return path.join(getAppStateDir(), 'session.json'); }
function getTimestampsPath() { return path.join(getAppStateDir(), 'fetch_timestamps.json'); }
function getPresenterPath()  { return path.join(getAppStateDir(), 'presenter_sync.json'); }

// Picklist JSON lives in ../data/, named by event code
function getPicklistPath(eventCode) {
  const name = eventCode
    ? `picklist_${eventCode.replace(/[^a-z0-9_\-]/gi, '_')}.json`
    : 'picklist.json';
  return path.join(ensureDataDir(), name);
}

// ── Generic safe read / write ─────────────────────────────────────────────────
function readJSON(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeJSON error:', filePath, e.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  FOLDER WATCHER
//
//  Watches ../data/ for .csv or .json files dropped in by the tablets.
//  When a new file appears:
//    1. Read it and send to the renderer for ingestion
//    2. Move it to data/imported/  so it won't be re-processed
//
//  Files that start with "picklist" are ignored (those are our own output).
// ══════════════════════════════════════════════════════════════════════════════

let watcher = null;

function isIgnoredFile(filename) {
  return filename.startsWith('picklist');
}

function startWatcher() {
  ensureDataDir();

  const importedDir = path.join(DATA_DIR, 'imported');
  if (!fs.existsSync(importedDir)) fs.mkdirSync(importedDir);

  if (watcher) { try { watcher.close(); } catch {} }

  // Track filenames we've already queued to avoid double-firing
  const seen = new Set();

  watcher = fs.watch(DATA_DIR, { persistent: true }, (eventType, filename) => {
    if (!filename) return;
    if (!filename.endsWith('.csv') && !filename.endsWith('.json')) return;
    if (isIgnoredFile(filename)) return;
    if (seen.has(filename)) return;

    const filePath = path.join(DATA_DIR, filename);

    // Short delay so the file finishes writing before we read it
    setTimeout(() => {
      try {
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.trim()) return;

        seen.add(filename);

        // Send to renderer for ingestion
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('watcher:file', { name: filename, content });
        }

        // Move to imported/ so it doesn't get re-processed
        const dest = path.join(importedDir, `${Date.now()}_${filename}`);
        fs.renameSync(filePath, dest);

        // Allow the same filename again after 10s (tablet might re-export)
        setTimeout(() => seen.delete(filename), 10_000);

      } catch (e) {
        console.error('Watcher error on', filename, e.message);
        seen.delete(filename);
      }
    }, 600);
  });

  console.log('[watcher] Watching:', DATA_DIR);
}

// ══════════════════════════════════════════════════════════════════════════════
//  IPC HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Session (internal app state) ─────────────────────────────────────────────
ipcMain.handle('session:load', () => readJSON(getSessionPath(), null));
ipcMain.handle('session:save', (_, data) => writeJSON(getSessionPath(), data));
ipcMain.handle('session:clear', () => {
  // Wipe internal state files
  [getSessionPath(), getTimestampsPath(), getPresenterPath()].forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  });
  // Also remove picklist JSON files from the data folder
  try {
    fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('picklist'))
      .forEach(f => fs.unlinkSync(path.join(DATA_DIR, f)));
  } catch {}
  return true;
});

// ── Fetch timestamps ──────────────────────────────────────────────────────────
ipcMain.handle('timestamps:load', () => readJSON(getTimestampsPath(), {}));
ipcMain.handle('timestamps:save', (_, data) => writeJSON(getTimestampsPath(), data));

// ── Presenter sync ────────────────────────────────────────────────────────────
ipcMain.handle('presenter:load', () => readJSON(getPresenterPath(), null));
ipcMain.handle('presenter:save', (_, data) => writeJSON(getPresenterPath(), data));

// ── Picklist auto-save → ../data/ ─────────────────────────────────────────────
// The renderer calls this automatically whenever data changes (debounced ~2s).
// Returns the path it was written to so the UI can show it.
ipcMain.handle('picklist:autosave', (_, { eventCode, payload }) => {
  ensureDataDir();
  const filePath = getPicklistPath(eventCode);
  const ok = writeJSON(filePath, payload);
  return { ok, filePath };
});

// ── Folder info ───────────────────────────────────────────────────────────────
ipcMain.handle('app:dataDir', () => DATA_DIR);

// Open the data folder in Windows Explorer / macOS Finder
ipcMain.handle('app:openDataDir', () => {
  ensureDataDir();
  shell.openPath(DATA_DIR);
});

// Open a URL in the system browser — used for YouTube match replays
// (Electron's file:// protocol causes YouTube Error 153 with iframes)
ipcMain.handle('shell:openExternal', (_, url) => {
  if (url && (url.startsWith('https://www.youtube.com/') || url.startsWith('https://youtu.be/'))) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

// ── Manual export (native Save dialog, still available) ───────────────────────
ipcMain.handle('export:save', async (_, { defaultName, content, filterName, ext }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(DATA_DIR, defaultName),
    filters: [{ name: filterName || 'Files', extensions: [ext || 'json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, filePath };
});

// ── Manual import (native Open dialog, still available) ───────────────────────
ipcMain.handle('import:open', async (_, { filters }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    defaultPath: DATA_DIR,
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'Data Files', extensions: ['json', 'csv'] }],
  });
  if (canceled || !filePaths.length) return [];
  return filePaths.map(p => ({
    name: path.basename(p),
    content: fs.readFileSync(p, 'utf8'),
  }));
});

// ══════════════════════════════════════════════════════════════════════════════
//  WINDOWS
// ══════════════════════════════════════════════════════════════════════════════

let mainWindow = null;
let presenterWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Team 935 & 757 · Strategy Portal',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    if (presenterWindow) presenterWindow.close();
  });
}

// Presenter window — opened via IPC from renderer
ipcMain.handle('presenter:open', () => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.focus();
    return;
  }
  presenterWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Presenter View · 2026',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  presenterWindow.loadFile('index.html', { query: { mode: 'presenter' } });
  presenterWindow.on('closed', () => { presenterWindow = null; });
});

// Live presenter sync — main window pushes state on every change
ipcMain.on('presenter:push', (_, data) => {
  writeJSON(getPresenterPath(), data);
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.webContents.send('presenter:update', data);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  APP LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
  ensureDataDir();
  createMainWindow();
  startWatcher();
  app.on('activate', () => { if (!mainWindow) createMainWindow(); });
});

app.on('window-all-closed', () => {
  if (watcher) { try { watcher.close(); } catch {} watcher = null; }
  if (process.platform !== 'darwin') app.quit();
});