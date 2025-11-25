# HDRezka Comfort View
<img width="100%" height="*" alt="github" src="https://github.com/user-attachments/assets/2c8fa7f4-13a0-4801-9575-ed991874ee45" />

> Chrome extension that keeps HDRezka binge-friendly with floating episode controls, casting helpers, and per-show zoom memory.
>
> Расширение Chrome, которое делает HDRezka удобным для просмотра в полноэкранном режиме, добавляя плавающие элементы управления эпизодами, помощь для Chromecast и память масштабирования для каждого сезона.

## Overview

`manifest.json` defines a Manifest V3 content script that injects `next_button.js`/`next_button.css` on every `hdrezka`/`rezka` domain. No background/service worker code is required—the entire feature set lives in the injected script. The script augments the site player with richer controls and stores user preferences locally (via cookies) so every show remembers its preferred zoom level.

## Features

- **Prev/Next episode buttons** – float alongside the player controls, follow the active season automatically, and disable themselves when there is no next/previous item.
- **Auto-start after switching** – when you jump to another episode the extension taps the player’s play control so the new episode starts without extra clicks.
- **Dedicated cast button** – mirrors the native Chromecast state (inactive/active icon) and lets you start or stop casting from the main control row.
- **Cast-safe episode switching** – while casting, the extension remembers the CDN stream for each episode and reloads the correct one into the active cast session whenever you move prev/next.
- **Auto-advance during cast** – near the end of an episode the extension preps the player, advances to the next episode, and retries play so casting continues hands-free.
- **Rich tooltips and labels** – buttons show clear `S#:E#` hints and update whenever the active episode changes.
- **Adaptive layout** – buttons match the player’s shape/colors, size themselves to the control bar, and hide when the native UI collapses.
- **Video zoom controls** – zoom in/out/reset buttons apply a smooth scale to the video; each show-season pair remembers its own zoom level.
- **Scroll-to-zoom** – while a zoom button is hovered, the mouse wheel adjusts zoom (wheel down to zoom in, wheel up to zoom out) without moving the page.

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

- **Prev/Next** – hover to see which episode will play (shows `S#:E#`); click to switch. The buttons disable themselves when you reach the ends of the list and auto-follow season changes.
- **Zoom** – click zoom out / reset / zoom in to resize the video. Hover any zoom button and roll the mouse wheel: wheel down zooms in, wheel up zooms out. Your zoom preference is remembered per show and season; reset returns to default size.
- **Casting**  
  - Use the dedicated cast button to start or stop casting; its icon shows the current cast state.  
  - When casting, switching episodes keeps the cast session alive and reloads the correct stream for the new episode automatically.  
  - Near the end of an episode the extension preps the player, advances to the next episode, and retries play so casting keeps running with minimal intervention.
- **Auto-start** – after any episode change, playback is nudged to start so you rarely need to press play yourself.
- **Layout harmony** – buttons sit on the same control row as the native player, inherit its coloring, and hide whenever the player UI hides.

## Development notes

- Manifest V3, `"activeTab"` permission only.
- Content script: `next_button.js` (vanilla JS, immediately-invoked function).
- Styles: `next_button.css` (scoped to the injected buttons).
- No build step—edit files and reload the unpacked extension to test.
- Cast bridge: `recast_helper.js` is injected into the page to reuse the site’s own Chromecast sender, capture per-episode manifest URLs, and feed them into the extension’s cast reload logic.

## Roadmap ideas

- Provide localised tooltips and button labels.
- Publish to the Chrome Web Store with automated packaging scripts.
