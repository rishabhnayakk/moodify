/* global window */
const panel = window.moodifyPanel;

// ── State ─────────────────────────────────────────────────────────────────────
let currentMood    = "Happy";
let isPlaying      = false;
let trackProgress  = 0;
let trackDuration  = 1;
let progressTimer  = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const elLoading      = $("loading");
const elSetup        = $("setup");
const elMain         = $("main");
const elAlbumImg     = $("album-img");
const elNoArt        = $("no-art");
const elTrackName    = $("track-name");
const elTrackArtist  = $("track-artist");
const elProgressFill = $("progress-fill");
const elBtnPlayPause = $("btn-play-pause");
const elBtnPrev      = $("btn-prev");
const elBtnNext      = $("btn-next");
const elBtnRefresh   = $("btn-refresh");
const elBtnClose     = $("btn-close");
const elMoodLabel    = $("mood-label");
const elPlaylistsList= $("playlists-list");
const elErrorBar     = $("error-bar");
const elBtnDashLink  = $("btn-dash-link");

const MOOD_EMOJI = {
  Happy: "😊", Sad: "😢", Angry: "😡",
  Romantic: "❤️", Sleepy: "😴", Excited: "🤩", Calm: "🦋",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showScreen(name) {
  elLoading.classList.toggle("hidden", name !== "loading");
  elSetup.classList.toggle("hidden",   name !== "setup");
  elMain.classList.toggle("hidden",    name !== "main");
}

function setError(msg) {
  elErrorBar.textContent = msg ? `⚠ ${msg}` : "";
}

// ── Progress ticker ───────────────────────────────────────────────────────────
function startProgressTick() {
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!isPlaying) return;
    trackProgress = Math.min(trackProgress + 1000, trackDuration);
    const pct = trackDuration > 0 ? (trackProgress / trackDuration) * 100 : 0;
    elProgressFill.style.width = pct + "%";
  }, 1000);
}

// ── Track rendering ───────────────────────────────────────────────────────────
function renderTrack(track) {
  if (!track) {
    elTrackName.textContent   = "Nothing playing";
    elTrackArtist.textContent = "Open Spotify to begin";
    elAlbumImg.classList.add("hidden");
    elNoArt.classList.remove("hidden");
    elProgressFill.style.width = "0%";
    elBtnPlayPause.textContent = "▶";
    isPlaying = false;
    return;
  }

  elTrackName.textContent   = track.name;
  elTrackArtist.textContent = track.artist;

  if (track.image) {
    elAlbumImg.src = track.image;
    elAlbumImg.classList.remove("hidden");
    elNoArt.classList.add("hidden");
  } else {
    elAlbumImg.classList.add("hidden");
    elNoArt.classList.remove("hidden");
  }

  isPlaying     = track.isPlaying;
  trackProgress = track.progress;
  trackDuration = track.duration || 1;

  const pct = (trackProgress / trackDuration) * 100;
  elProgressFill.style.width = pct + "%";
  elBtnPlayPause.textContent = isPlaying ? "⏸" : "▶";
}

// ── Playlist rendering ────────────────────────────────────────────────────────
function renderPlaylists(playlists, mood) {
  const emoji = MOOD_EMOJI[mood] || "🎭";
  elMoodLabel.textContent = `${emoji} ${mood} Playlists`;

  if (!playlists?.length) {
    elPlaylistsList.innerHTML = `<div id="playlists-empty">No playlists found</div>`;
    return;
  }

  elPlaylistsList.innerHTML = playlists.map(p => `
    <div class="playlist-item" data-uri="${esc(p.uri)}">
      <div class="playlist-thumb">
        ${p.image
          ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
          : "🎵"}
      </div>
      <div class="playlist-info">
        <div class="playlist-name">${esc(p.name)}</div>
        <div class="playlist-meta">${p.owner ? esc(p.owner) + " · " : ""}${p.tracks} tracks</div>
      </div>
      <span class="playlist-play">▶</span>
    </div>
  `).join("");

  elPlaylistsList.querySelectorAll(".playlist-item").forEach(el => {
    el.addEventListener("click", async () => {
      try {
        await panel.playPlaylist(el.dataset.uri);
        setTimeout(refreshTrack, 1200);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    });
  });
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function refreshTrack() {
  try {
    const track = await panel.getTrack();
    renderTrack(track);
    setError("");
  } catch (e) {
    setError(e.message);
  }
}

async function refreshPlaylists(mood) {
  try {
    const list = await panel.getPlaylists(mood);
    renderPlaylists(list, mood);
    setError("");
  } catch (e) {
    setError(e.message);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  showScreen("loading");

  const hasCreds = await panel.hasCredentials().catch(() => false);
  if (!hasCreds) { showScreen("setup"); return; }

  showScreen("main");
  await Promise.all([refreshTrack(), refreshPlaylists(currentMood)]);
  startProgressTick();

  // Poll current track every 5 s
  setInterval(refreshTrack, 5000);
}

// ── Controls ──────────────────────────────────────────────────────────────────
elBtnPlayPause.addEventListener("click", async () => {
  try {
    if (isPlaying) {
      await panel.pause();
      isPlaying = false;
      elBtnPlayPause.textContent = "▶";
    } else {
      await panel.resume();
      isPlaying = true;
      elBtnPlayPause.textContent = "⏸";
    }
    setError("");
  } catch (e) { setError(e.message); }
});

elBtnPrev.addEventListener("click", async () => {
  try { await panel.prev(); setTimeout(refreshTrack, 600); setError(""); }
  catch (e) { setError(e.message); }
});

elBtnNext.addEventListener("click", async () => {
  try { await panel.next(); setTimeout(refreshTrack, 600); setError(""); }
  catch (e) { setError(e.message); }
});

elBtnRefresh.addEventListener("click", async () => {
  elBtnRefresh.style.transform = "rotate(180deg)";
  elBtnRefresh.style.transition = "transform 0.4s";
  await Promise.all([refreshTrack(), refreshPlaylists(currentMood)]);
  setTimeout(() => { elBtnRefresh.style.transform = ""; }, 400);
});

elBtnClose.addEventListener("click", () => panel.closePanel());

// Open Spotify developer dashboard in default browser
elBtnDashLink?.addEventListener("click", () => {
  panel.openExternal("https://developer.spotify.com/dashboard");
});

// ── Mood change from main process ─────────────────────────────────────────────
panel.onMoodChange(mood => {
  currentMood = mood;
  refreshPlaylists(mood);
});

init();

