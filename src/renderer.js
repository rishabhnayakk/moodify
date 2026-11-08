const rain = document.getElementById("rain");
const DENSITY = { Light: 12, Normal: 24, Heavy: 42 };
let state = { mood: "Happy", emojis: ["😊", "😂", "😁", "🌈"], paused: false, density: "Normal" };
let timer = null;

function random(min, max) { return Math.random() * (max - min) + min; }

function dropEmoji() {
  if (state.paused || document.hidden) return;
  const emoji = document.createElement("span");
  emoji.className = "emoji";
  emoji.textContent = state.emojis[Math.floor(Math.random() * state.emojis.length)];
  const size = random(24, 54);
  emoji.style.setProperty("--x", random(0, 98) + "vw");
  emoji.style.setProperty("--size", size + "px");
  emoji.style.setProperty("--duration", random(5.5, 10) + "s");
  emoji.style.setProperty("--delay", random(0, 1.2) + "s");
  emoji.style.setProperty("--sway", random(-90, 90) + "px");
  emoji.style.setProperty("--opacity", random(.68, .98));
  rain.appendChild(emoji);
  emoji.addEventListener("animationend", () => emoji.remove(), { once: true });
}

function startRain() {
  stopRain();
  if (state.paused) return;
  const count = DENSITY[state.density] || DENSITY.Normal;
  for (let i = 0; i < count; i++) setTimeout(dropEmoji, i * 110);
  timer = setInterval(dropEmoji, Math.max(180, 12000 / count));
}

function stopRain() {
  if (timer) clearInterval(timer);
  timer = null;
}

function applyState(next) {
  state = { ...state, ...next };
  if (state.paused) {
    stopRain();
    rain.replaceChildren();
  } else {
    startRain();
  }
}

window.moodify.onUpdate(applyState);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !state.paused) startRain();
});
window.addEventListener("resize", () => {
  if (!state.paused) startRain();
});
