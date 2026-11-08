// Load .env from project root before anything else
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env") });

const {
  app, BrowserWindow, Tray, Menu, screen,
  nativeImage, globalShortcut, ipcMain, shell,
} = require("electron");
const path = require("node:path");
const spotify = require("./spotify");

const MOODS = {
  Happy:    ["😊", "😂", "😁", "🌈", "😎", "✨"],
  Sad:      ["😢", "🥺", "💧", "☔", "🩵", "🌧️"],
  Angry:    ["😡", "🔥", "💢", "👿", "⚡"],
  Romantic: ["❤️", "💕", "🥰", "💗", "💘", "🌹"],
  Sleepy:   ["😴", "💤", "🌙", "🛌", "⭐"],
  Excited:  ["🤩", "⚡", "🚀", "🎉", "🥳", "💥"],
  Calm:     ["🦋", "🌸", "🍃", "🕊️", "🌿", "☁️"],
};

let tray;
let overlays    = [];
let musicPanel  = null;
let currentMood = "Happy";
let paused      = false;
let density     = "Normal";

// ── Emoji overlay windows ─────────────────────────────────────────────────────

function createOverlay(display) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width:  display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, "index.html"));
  win.once("ready-to-show", () => {
    win.webContents.send("moodify:update", {
      mood: currentMood, emojis: MOODS[currentMood], paused, density,
    });
    win.showInactive();
  });
  win.on("closed", () => { overlays = overlays.filter(w => w !== win); });
  overlays.push(win);
}

function createOverlays() {
  for (const display of screen.getAllDisplays()) createOverlay(display);
}

// ── Music panel window ────────────────────────────────────────────────────────

function createMusicPanel() {
  if (musicPanel && !musicPanel.isDestroyed()) {
    musicPanel.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  musicPanel = new BrowserWindow({
    width:  300,
    height: 490,
    x: width  - 316,
    y: height - 506,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload-panel.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  musicPanel.setAlwaysOnTop(true, "floating");
  musicPanel.loadFile(path.join(__dirname, "panel.html"));
  musicPanel.on("closed", () => { musicPanel = null; });
}

// ── Broadcast state to all windows ───────────────────────────────────────────

function broadcast() {
  const state = { mood: currentMood, emojis: MOODS[currentMood], paused, density };
  for (const win of overlays) {
    if (!win.isDestroyed()) win.webContents.send("moodify:update", state);
  }
  if (musicPanel && !musicPanel.isDestroyed()) {
    musicPanel.webContents.send("moodify:mood-change", currentMood);
  }
}

// ── Tray menu ─────────────────────────────────────────────────────────────────

function buildTrayMenu() {
  const moodItems = Object.entries(MOODS).map(([mood, emojis]) => ({
    label:   `${emojis[0]}  ${mood}`,
    type:    "radio",
    checked: currentMood === mood,
    click:   () => { currentMood = mood; broadcast(); buildTrayMenu(); },
  }));

  const menu = Menu.buildFromTemplate([
    { label: "Moodify", enabled: false },
    { type: "separator" },
    { label: "Choose your mood", enabled: false },
    ...moodItems,
    { type: "separator" },
    {
      label: paused ? "▶ Resume emoji rain" : "⏸ Pause emoji rain",
      click: () => { paused = !paused; broadcast(); buildTrayMenu(); },
    },
    {
      label: "Emoji density",
      submenu: [
        { label: "Light",  type: "radio", checked: density === "Light",  click: () => { density = "Light";  broadcast(); buildTrayMenu(); } },
        { label: "Normal", type: "radio", checked: density === "Normal", click: () => { density = "Normal"; broadcast(); buildTrayMenu(); } },
        { label: "Heavy",  type: "radio", checked: density === "Heavy",  click: () => { density = "Heavy";  broadcast(); buildTrayMenu(); } },
      ],
    },
    { type: "separator" },
    { label: "🎵 Music Panel", click: () => createMusicPanel() },
    { type: "separator" },
    { label: "Quit Moodify", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text x="2" y="26" font-size="26">😊</text></svg>';
  tray = new Tray(nativeImage.createFromDataURL(
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64")
  ));
  tray.setToolTip("Moodify — mood-based emoji rain");
  buildTrayMenu();
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function setupIpc() {
  ipcMain.handle("spotify:has-credentials",  ()         => spotify.hasCredentials());
  ipcMain.handle("spotify:get-playlists",    (_e, mood) => spotify.searchPlaylists(mood));
  ipcMain.handle("spotify:get-track",        ()         => spotify.getCurrentTrack());
  ipcMain.handle("spotify:play-playlist",    (_e, uri)  => spotify.playPlaylist(uri));
  ipcMain.handle("spotify:pause",            ()         => spotify.pausePlayback());
  ipcMain.handle("spotify:resume",           ()         => spotify.resumePlayback());
  ipcMain.handle("spotify:next",             ()         => spotify.nextTrack());
  ipcMain.handle("spotify:prev",             ()         => spotify.prevTrack());
  ipcMain.handle("shell:open-external",      (_e, url)  => shell.openExternal(url));
  ipcMain.on("panel:close", () => {
    if (musicPanel && !musicPanel.isDestroyed()) musicPanel.close();
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.dock?.hide();
  setupIpc();
  createTray();
  createOverlays();

  // Cmd/Ctrl+Shift+M → toggle rain
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    paused = !paused;
    broadcast();
    buildTrayMenu();
  });

  screen.on("display-added",   (_event, display) => createOverlay(display));
  screen.on("display-removed", () => {
    for (const win of overlays) if (!win.isDestroyed()) win.close();
    overlays = [];
    createOverlays();
  });
});

app.on("will-quit",         () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
