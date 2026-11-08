# Moodify 🌈

Moodify is a tiny macOS desktop companion that lets a shower of emojis fall across your desktop according to the mood you choose.

## Features

- Transparent, frameless desktop overlay.
- Seven moods: Happy, Sad, Angry, Romantic, Sleepy, Excited and Calm.
- Continuous falling emoji animation with varied sizes, speed, rotation and drift.
- Menu-bar control to change mood, pause/resume, and choose Light / Normal / Heavy density.
- Keyboard shortcut: `Cmd + Shift + M` to pause or resume.
- Supports multiple displays.

## Requirements

- macOS
- Node.js 20 or newer
- npm

## Run locally

```bash
git clone https://github.com/rishabhnayakk/moodify.git
cd moodify
npm install
npm start
```

Moodify appears as a menu-bar item. Click its menu-bar icon to choose a mood and control the rain. The overlay is click-through so it does not block your desktop apps.

## Build a macOS app

```bash
npm run dist
```

The installer artifacts will be created in the `dist/` directory.

## Notes

- This first version is an emoji-rain desktop app; Spotify playback and automatic mood detection are not included yet.
- macOS may ask you to approve or open an app downloaded from an unidentified developer when running a locally built package.
- The overlay uses an always-on-top transparent window. Behavior can vary slightly between macOS versions and full-screen spaces.

## License

MIT
