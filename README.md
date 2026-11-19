# Moodify 🌈

Moodify is a tiny macOS desktop companion that lets a shower of emojis fall across your desktop according to the mood you choose.

## Features

- Transparent, frameless desktop overlay.
- Seven moods: Happy, Sad, Angry, Romantic, Sleepy, Excited and Calm.
- Continuous falling emoji animation with varied sizes, speed, rotation and drift.
- Menu-bar control to change mood, pause/resume, and choose Light / Normal / Heavy density.
- Keyboard shortcut: `Cmd + Shift + M` to pause or resume.
- Supports multiple displays.

## Download a macOS installer

Prebuilt installers are produced by GitHub Actions for both Apple Silicon (arm64) and Intel (x64) Macs.

1. Open the repository's [Actions](https://github.com/rishabhnayakk/moodify/actions) page.
2. Open the latest successful **Build macOS installers** run.
3. Under **Artifacts**, download `Moodify-macOS-arm64` for Apple Silicon or `Moodify-macOS-x64` for Intel.
4. Unzip the downloaded artifact if needed, open the `.dmg`, and drag Moodify into Applications.

These CI builds are unsigned. On first launch, macOS may block the app. If you trust the build, Control-click Moodify in Applications, choose **Open**, then confirm. A signed/notarized release requires an Apple Developer signing identity and notarization credentials.

## Requirements for running from source

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

Moodify is a menu-bar app: look for its icon in the macOS menu bar (near Control Center). Click it to choose a mood and control the emoji rain. The overlay is click-through so it does not block your desktop apps.

## Build a macOS app locally

```bash
npm run dist
```

The installer artifacts will be created in the `dist/` directory.

## Spotify music panel (optional)

The emoji overlay works without Spotify credentials. To use the optional music panel, create a `.env` file in the project root with Spotify API credentials:

```dotenv
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=your_refresh_token
```

Restart Moodify after adding credentials. Never commit your real `.env` file or publish your client secret/refresh token.

## Notes

- This first version is an emoji-rain desktop app; automatic mood detection is not included.
- The overlay uses an always-on-top transparent window. Behavior can vary slightly between macOS versions and full-screen spaces.

## License

MIT
