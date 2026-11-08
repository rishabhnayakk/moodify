/**
 * spotify.js — Spotify Web API client for Moodify
 * Reads credentials from .env via dotenv (loaded in main.js).
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_URL  = "https://api.spotify.com/v1";

let _accessToken  = null;
let _tokenExpiry  = 0;

// ── Mood → Spotify search query mapping ──────────────────────────────────────
const MOOD_QUERIES = {
  Happy:    "happy upbeat pop feel good",
  Sad:      "sad emotional indie rainy day",
  Angry:    "angry hard rock energy intense",
  Romantic: "romantic love songs slow",
  Sleepy:   "chill sleep ambient lo-fi",
  Excited:  "excited hype electronic party",
  Calm:     "calm peaceful instrumental relax",
};

// ── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    throw new Error("Spotify credentials missing — fill in .env");
  }

  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
      client_id:     SPOTIFY_CLIENT_ID,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

async function getToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  return refreshAccessToken();
}

// ── Low-level HTTP helpers ────────────────────────────────────────────────────

async function apiGet(path) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPut(path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) throw new Error(`Spotify PUT ${path} → ${res.status}`);
}

async function apiPost(path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) throw new Error(`Spotify POST ${path} → ${res.status}`);
  return res.status !== 204 ? res.json().catch(() => null) : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

function hasCredentials() {
  return !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REFRESH_TOKEN &&
    process.env.SPOTIFY_CLIENT_ID     !== "your_client_id_here" &&
    process.env.SPOTIFY_REFRESH_TOKEN !== "your_refresh_token_here"
  );
}

async function searchPlaylists(mood, limit = 6) {
  const q   = encodeURIComponent(MOOD_QUERIES[mood] || mood);
  const data = await apiGet(`/search?q=${q}&type=playlist&limit=${limit}`);
  return (data?.playlists?.items ?? []).filter(Boolean).map(p => ({
    id:     p.id,
    name:   p.name,
    image:  p.images?.[0]?.url ?? null,
    uri:    p.uri,
    owner:  p.owner?.display_name ?? "",
    tracks: p.tracks?.total ?? 0,
  }));
}

async function getCurrentTrack() {
  const data = await apiGet("/me/player/currently-playing");
  if (!data?.item) return null;
  return {
    name:      data.item.name,
    artist:    data.item.artists.map(a => a.name).join(", "),
    album:     data.item.album.name,
    image:     data.item.album.images?.[0]?.url ?? null,
    isPlaying: data.is_playing,
    uri:       data.item.uri,
    progress:  data.progress_ms,
    duration:  data.item.duration_ms,
  };
}

async function playPlaylist(uri)   { await apiPut("/me/player/play", { context_uri: uri }); }
async function pausePlayback()     { await apiPut("/me/player/pause"); }
async function resumePlayback()    { await apiPut("/me/player/play"); }
async function nextTrack()         { await apiPost("/me/player/next"); }
async function prevTrack()         { await apiPost("/me/player/previous"); }

module.exports = {
  hasCredentials,
  searchPlaylists,
  getCurrentTrack,
  playPlaylist,
  pausePlayback,
  resumePlayback,
  nextTrack,
  prevTrack,
  MOOD_QUERIES,
};

