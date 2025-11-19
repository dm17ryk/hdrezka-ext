# HDRezka Comfort View

> Chrome extension that keeps HDRezka binge-friendly with floating episode controls and per-show zoom memory.

<img width="930" height="1105" alt="next-button-look-new-21" src="https://github.com/user-attachments/assets/aae7ded0-7e2e-4401-aa0a-9ab35e40b994" />

## Overview

`manifest.json` defines a Manifest V3 content script that injects `next_button.js`/`next_button.css` on every `hdrezka`/`rezka` domain. No background/service worker code is required—the entire feature set lives in the injected script. The script augments the site player with richer controls and stores user preferences locally (via cookies) so every show remembers its preferred zoom level.

## Features

- **Instant prev/next episode buttons** – attaches to the in-player controls, reads the active episode in `.b-simple_episode__item`, and auto-clicks into the right list when seasons change.
- **Automatic playback start** – after switching episodes the script nudges the hidden player start button to resume playback without extra clicks.
- **Context-aware tooltips & aria labels** – tooltips display `S#:E#` information and update whenever the active episode changes for better accessibility.
- **Smart control layout** – buttons inherit player border radius, palette, and positioning, hiding themselves whenever the player UI is collapsed.
- **Video zoom controls** – zoom in/out/reset buttons (±0.04 steps, clamped between 0.5x–2x) apply CSS transforms on the `<video>` element.
- **Per-show zoom memory** – zoom levels persist in cookies using a `hdrezka_zoom_<slug>_s<season>` key, so each show-season combo keeps its own preference.

## Supported domains

The content script is injected on each of the following origins (including subdomains):

`hdrezka.website`, `hdrezka.ag`, `rezka.ag`, `rezka-ua.tv`, `hdrezka.co`, `hdrezka.name`, `hdrezka.ink`

## Visual tour

<img width="926" height="1005" alt="next-button-look-new-22" src="https://github.com/user-attachments/assets/0a6b3002-3988-4177-a3e1-c34d530f12e6" />

<img width="922" height="1107" alt="next-button-look-new-23" src="https://github.com/user-attachments/assets/b53562d3-526a-404f-910f-023b850427a0" />

## Installation (Chrome/Chromium)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and choose the repository folder.
5. Visit any supported HDRezka domain and start watching an episode—the overlay controls appear on top of the native timeline.

> For other Chromium-based browsers (Brave, Edge, Vivaldi, Opera GX, etc.) follow their equivalent “load unpacked” flow.

## Usage tips

- Use the new **Prev**/**Next** icons that appear above the play button. They respect keyboard/mouse hover states and will disable themselves when no episode exists.
- **Zoom in/out** with the ✚ and ▬ buttons; hit **Z-Reset** to jump back to 1×. Each show-season pair remembers its last zoom level.
- The script continuously watches for DOM mutations and adjusts layout every 800 ms to keep buttons aligned with the player even when the site changes its UI.

## Development notes

- Manifest V3, `"activeTab"` permission only.
- Content script: `next_button.js` (vanilla JS, immediately-invoked function).
- Styles: `next_button.css` (scoped to the injected buttons).
- No build step—edit files and reload the unpacked extension to test.

## Roadmap ideas

- Add casting-specific helpers (see `stop_cast.js`) once integrated into the manifest.
- Provide localised tooltips and button labels.
- Publish to the Chrome Web Store with automated packaging scripts.
