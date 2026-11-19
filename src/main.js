// Load .env from project root before anything else
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env") });

const {
  app, BrowserWindow, Tray, Menu, screen,
  nativeImage, globalShortcut, ipcMain, shell, session,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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

// Renderer windows only load their own local HTML file. Block navigation,
// popups and embedded webviews so renderer content cannot escape this boundary.
function hardenWindow(win, pageName) {
  const trustedUrl = pathToFileURL(path.join(__dirname, pageName)).href;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== trustedUrl) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", event => event.preventDefault());
}

function isTrustedPanelSender(event) {
  return !!(
    musicPanel &&
    !musicPanel.isDestroyed() &&
    event.sender === musicPanel.webContents &&
    event.senderFrame?.url === pathToFileURL(path.join(__dirname, "panel.html")).href
  );
}

function assertTrustedPanelSender(event) {
  if (!isTrustedPanelSender(event)) {
    throw new Error("Blocked IPC request from an untrusted renderer");
  }
}

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

  hardenWindow(win, "index.html");
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

  hardenWindow(musicPanel, "panel.html");
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
  // Electron's nativeImage decoder supports PNG/JPEG, not SVG. Use a native
  // macOS SF Symbol so the menu-bar icon is valid and adapts to light/dark mode.
  let icon = nativeImage.createFromNamedImage("face.smiling", {
    pointSize: 18,
    weight: "medium",
  });

  if (!icon.isEmpty()) {
    icon.setTemplateImage(true);
  } else {
    // Valid 16x16 PNG fallback in case the SF Symbol is unavailable.
    icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII="
    );
  }

  tray = new Tray(icon);
  tray.setToolTip("Moodify — mood-based emoji rain");
  buildTrayMenu();
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function setupIpc() {
  ipcMain.handle("spotify:has-credentials", event => {
    assertTrustedPanelSender(event);
    return spotify.hasCredentials();
  });
  ipcMain.handle("spotify:get-playlists", (event, mood) => {
    assertTrustedPanelSender(event);
    return spotify.searchPlaylists(mood);
  });
  ipcMain.handle("spotify:get-track", event => {
    assertTrustedPanelSender(event);
    return spotify.getCurrentTrack();
  });
  ipcMain.handle("spotify:play-playlist", (event, uri) => {
    assertTrustedPanelSender(event);
    if (typeof uri !== "string" || !/^spotify:playlist:[A-Za-z0-9]+$/.test(uri)) {
      throw new Error("Invalid Spotify playlist identifier");
    }
    return spotify.playPlaylist(uri);
  });
  ipcMain.handle("spotify:pause", event => {
    assertTrustedPanelSender(event);
    return spotify.pausePlayback();
  });
  ipcMain.handle("spotify:resume", event => {
    assertTrustedPanelSender(event);
    return spotify.resumePlayback();
  });
  ipcMain.handle("spotify:next", event => {
    assertTrustedPanelSender(event);
    return spotify.nextTrack();
  });
  ipcMain.handle("spotify:prev", event => {
    assertTrustedPanelSender(event);
    return spotify.prevTrack();
  });
  ipcMain.handle("shell:open-external", (event, url) => {
    assertTrustedPanelSender(event);
    if (url !== "https://developer.spotify.com/dashboard") {
      throw new Error("Blocked external URL");
    }
    return shell.openExternal(url);
  });
  ipcMain.on("panel:close", event => {
    if (!isTrustedPanelSender(event)) return;
    if (musicPanel && !musicPanel.isDestroyed()) musicPanel.close();
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Moodify needs no OS permissions. Deny all renderer permission requests.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

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
