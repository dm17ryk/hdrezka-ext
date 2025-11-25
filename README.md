# HDRezka Comfort View
<img width="1400" height="560" alt="marquee" src="https://github.com/user-attachments/assets/312870cf-e88d-4c2f-bb02-4ec145efd15e" />

> Chrome extension that keeps HDRezka binge-friendly with floating episode controls, casting helpers, and per-show zoom memory.
>
> Расширение Chrome, которое делает HDRezka удобным для просмотра в полноэкранном режиме, добавляя плавающие элементы управления эпизодами, помощь для Chromecast и память масштабирования для каждого сезона.

## Overview

`manifest.json` defines a Manifest V3 content script that injects `next_button.js`/`next_button.css` on every `hdrezka`/`rezka` domain. No background/service worker code is required—the entire feature set lives in the injected script. The script augments the site player with richer controls and stores user preferences locally (via cookies) so every show remembers its preferred zoom level.

## Features

- **Instant prev/next episode buttons** – attaches to the in-player controls, reads the active episode in `.b-simple_episode__item`, and auto-clicks into the right list when seasons change.
- **Automatic playback start** – after switching episodes the script nudges the hidden player start button to resume playback without extra clicks.
- **Chromecast toggle** – a dedicated cast button sits with the player controls, mirrors the native cast state (inactive/active icons), and lets you start/stop casting without hunting the built-in icon.
- **Cast-stable episode switching** – when casting, the extension caches the CDN manifest for each episode and reloads the correct stream into the active cast session when you go prev/next.
- **Auto-advance on cast** – near the end of an episode (ratio ≈ 0.99) it seeks to the start to “prime” playback, clicks next, and ensures the new episode starts; if playback stalls it retries play.
- **Context-aware tooltips & aria labels** – tooltips display `S#:E#` information and update whenever the active episode changes for better accessibility.
- **Smart control layout** – buttons inherit player border radius, palette, and positioning, hiding themselves whenever the player UI is collapsed.
- **Video zoom controls** – zoom in/out/reset buttons (±0.04 steps, clamped between 0.5x–2x) apply CSS transforms on the `<video>` element.
- **Per-show zoom memory** – zoom levels persist in cookies using a `hdrezka_zoom_<slug>_s<season>` key, so each show-season combo keeps its own preference.

## Preview
<img width="1487" height="1007" alt="pre1" src="https://github.com/user-attachments/assets/37743805-cfbf-4457-82db-3121fd589aff" />
<img width="1490" height="1005" alt="pre2" src="https://github.com/user-attachments/assets/4374f59d-c4d8-44c3-9800-223b9c904bcf" />
<img width="1483" height="1006" alt="pre3" src="https://github.com/user-attachments/assets/6b6ad748-5b7b-437a-ac51-abf38b2c50c2" />
<img width="1487" height="1005" alt="pre4" src="https://github.com/user-attachments/assets/90eb5db0-7a1c-43b8-9d4f-5ca25d869e21" />

## Preview Custing
<img width="1486" height="1003" alt="pre5" src="https://github.com/user-attachments/assets/5a6ff8fe-a1ca-442a-bc48-f009332031fc" />

## Full Screen Preview (Zoom ratio 1 -> not zoomed)
<img width="5118" height="1438" alt="next-button-look-new-38" src="https://github.com/user-attachments/assets/a9c54d88-36ac-4271-8557-4508eed2c971" />

## Full Screen Preview (Zoom ratio 2 -> zoomed twice)
<img width="5118" height="1438" alt="next-button-look-new-39" src="https://github.com/user-attachments/assets/c43b743a-c43c-450d-b558-0d29f410b3b9" />

## Supported domains

The content script is injected on each of the following origins (including subdomains):

`hdrezka.website`, `hdrezka.ag`, `rezka.ag`, `rezka-ua.tv`, `hdrezka.co`, `hdrezka.name`, `hdrezka.ink`

## Visual tour

## Installation (Chrome/Chromium)

1. https://chromewebstore.google.com/detail/hdrezka-comfort-view/jnmabcpplkemmnlcpinffgmceenfjknd

> For other Chromium-based browsers (Brave, Edge, Vivaldi, Opera GX, etc.) follow their equivalent extension installation flow.

## Usage tips

- Use the new **Prev**/**Next** icons that appear above the play button. They respect keyboard/mouse hover states and will disable themselves when no episode exists.
- **Zoom in/out** with the ✚ and ▬ buttons; hit **Z-Reset** to jump back to 1×. Each show-season pair remembers its last zoom level.
- The script continuously watches for DOM mutations and adjusts layout every 800 ms to keep buttons aligned with the player even when the site changes its UI.
- **Casting**:
  - The cast button mirrors native state (inactive/active icon) and uses the site’s Chromecast sender—no extra setup.
  - When you go prev/next while casting, the extension caches the CDN manifest for each episode (from the page’s `initCDNSeriesEvents` call) and reloads the correct stream into the active cast session.
  - Auto-advance: near the end (~99 % progress) it seeks to the start, clicks next, then ensures playback resumes on the new episode; if the cast doesn’t start immediately it issues a brief play retry.

## Development notes

- Manifest V3, `"activeTab"` permission only.
- Content script: `next_button.js` (vanilla JS, immediately-invoked function).
- Styles: `next_button.css` (scoped to the injected buttons).
- No build step—edit files and reload the unpacked extension to test.
- Cast bridge: `recast_helper.js` is injected into the page to reuse the site’s own Chromecast sender, capture per-episode manifest URLs, and feed them into the extension’s cast reload logic.

## Roadmap ideas

- Provide localised tooltips and button labels.
- Publish to the Chrome Web Store with automated packaging scripts.
