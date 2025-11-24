// content.js

(function() {
  if (window.top !== window) {
    window.addEventListener('message', (event) => {
      if (event.source !== window.top && event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'hdrezka_frame_media_request') {
        let payload = null;
        try {
          const inst = window.pljssglobal && Array.isArray(window.pljssglobal) ? window.pljssglobal[0] : null;
          if (inst) {
            let apiPlaylist = null;
            let apiFile = null;
            try { apiPlaylist = inst.api ? inst.api('playlist') : null; } catch (error) {}
            try { apiFile = inst.api ? inst.api('file') : null; } catch (error) {}
            payload = {
              media: inst.media || null,
              playlist: inst.playlist || null,
              apiPlaylist,
              apiFile
            };
          }
        } catch (error) {
          payload = { error: String(error) };
        }
        window.postMessage({ type: 'hdrezka_frame_media_response', payload }, '*');
      }
    });
    return;
  }

  console.log('Content script reloaded');

  let nextButton;
  let prevButton;
  let zoomOutButton;
  let zoomResetButton;
  let zoomInButton;
  let rewindButton;
  const observedEpisodes = new WeakSet();
  const LAYOUT_INTERVAL_MS = 800;
  const BUTTON_MARGIN_PX = 12;
  const TIMELINE_PADDING_PX = 110;
  const PLAY_SVG_IDENTIFIER = '0.59375 0.48438';
  const NEXT_ICON_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5v14l8-7-8-7zm9 0v14h2V5h-2z"></path>
    </svg>
  `;
  const PREV_ICON_SVG = NEXT_ICON_SVG;
  const ZOOM_STEP = 0.04;
  const MAX_ZOOM = 2;
  const MIN_ZOOM = -2;
  const ZOOM_PRECISION = 2;
  const ZOOM_COOKIE_PREFIX = 'hdrezka_zoom_';
  let currentZoomLevel = 1;
  let castToggleButton;
  let castSessionListenerAttached = false;
  let castInitRequested = false;
  let lastEpisodeKey = null;
  let castBridgeState = null;
  let endEventHooked = false;
  const AUTO_CAST_PREP_OFFSET_SEC = 1.2;
  const AUTO_CAST_NEXT_DELAY_MS = 300;
  const AUTO_CAST_PLAY_DELAY_MS = 2000;
  const AUTO_CAST_PLAY_RETRY_MS = 2000;
  const AUTO_CAST_SEEK_DELAY_MS = 300;
  const AUTO_CAST_MAX_RETRIES = 3;
  const AUTO_CAST_NEAR_END_RATIO = 0.99;
  const autoAdvanceState = {
    phase: 'idle', // idle | waiting_start | ensure_play
    key: null,
    lastTime: 0,
    lastRatio: 0,
    waitStartUntil: 0,
    waitPlayUntil: 0,
    ensureAttempts: 0
  };
  const AUTO_LOG_PREFIX = '[hdrezka][auto]';
  let observedPlayButton = null;
  let playButtonHoverHandlers = null;
  let activeZoomStorageKey = null;
  const CAST_LABEL_START = 'Start Cast';
  const CAST_LABEL_STOP = 'Stop Cast';
  const CAST_MIN_WIDTH = 86;
  const CAST_RESUME_MAX_ATTEMPTS = 6;
  const CAST_RESUME_DELAY_MS = 600;
  const CAST_RELOAD_WINDOW_MS = 10000;
  let castHelperInjected = false;
  let castHelperReady = false;
  let castReloadTimer = null;
  const LOG_PREFIX = '[hdrezka][cast]';
  const episodeMediaCache = {};
  let lastEpisodeNavTs = 0;
  let pendingEpisodeKey = null;
  const CAST_ICON_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g>
        <path class="cast_caf_state_d" d="M1,18 L1,21 L4,21 C4,19.3 2.66,18 1,18 L1,18 Z"></path>
        <path class="cast_caf_state_d" d="M1,14 L1,16 C3.76,16 6,18.2 6,21 L8,21 C8,17.13 4.87,14 1,14 L1,14 Z"></path>
        <path class="cast_caf_state_d" d="M1,10 L1,12 C5.97,12 10,16.0 10,21 L12,21 C12,14.92 7.07,10 1,10 L1,10 Z"></path>
        <path class="cast_caf_state_d" d="M21,3 L3,3 C1.9,3 1,3.9 1,5 L1,8 L3,8 L3,5 L21,5 L21,19 L14,19 L14,21 L21,21 C22.1,21 23,20.1 23,19 L23,5 C23,3.9 22.1,3 21,3 L21,3 Z"></path>
        <path class="cast_caf_state_h" d="M5,7 L5,8.63 C8,8.6 13.37,14 13.37,17 L19,17 L19,7 Z"></path>
      </g>
    </svg>
  `;
  const CAST_ICON_SVG_ACTIVE = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g>
        <path class="cast_caf_state_c" d="M1,18 L1,21 L4,21 C4,19.3 2.66,18 1,18 L1,18 Z"></path>
        <path class="cast_caf_state_c" d="M1,14 L1,16 C3.76,16 6,18.2 6,21 L8,21 C8,17.13 4.87,14 1,14 L1,14 Z"></path>
        <path class="cast_caf_state_c" d="M1,10 L1,12 C5.97,12 10,16.0 10,21 L12,21 C12,14.92 7.07,10 1,10 L1,10 Z"></path>
        <path class="cast_caf_state_c" d="M21,3 L3,3 C1.9,3 1,3.9 1,5 L1,8 L3,8 L3,5 L21,5 L21,19 L14,19 L14,21 L21,21 C22.1,21 23,20.1 23,19 L23,5 C23,3.9 22.1,3 21,3 L21,3 Z"></path>
        <path class="cast_caf_state_c" d="M5,7 L5,8.63 C8,8.6 13.37,14 13.37,17 L19,17 L19,7 Z"></path>
      </g>
    </svg>
  `;

  function attachObserverToActive() {
    const activeEpisode = document.querySelector('.b-simple_episode__item.active');
    if (!activeEpisode || observedEpisodes.has(activeEpisode)) {
      return;
    }
    observedEpisodes.add(activeEpisode);
    const observer = new MutationObserver((mutations, obs) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (!activeEpisode.classList.contains('active')) {
            observedEpisodes.delete(activeEpisode);
            obs.disconnect();
            const newActiveEpisode = document.querySelector('.b-simple_episode__item.active');
            if (newActiveEpisode) {
              setTimeout(updateEpisodeButtons, 2000);
            }
          }
        }
      });
    });
    observer.observe(activeEpisode, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function getNextButtonTooltip(nextEpisode) {
    let season = null;
    let episode = null;
    if (
      nextEpisode &&
      nextEpisode.hasAttribute('data-season_id') &&
      nextEpisode.hasAttribute('data-episode_id')
    ) {
      season = nextEpisode.getAttribute('data-season_id');
      episode = nextEpisode.getAttribute('data-episode_id');
    }
    if (season && episode) {
      return `Play next episode S${ season }:E${ episode }`;
    }
    return 'No next episode available';
  }

  function getPrevButtonTooltip(prevEpisode) {
    let season = null;
    let episode = null;
    if (
      prevEpisode &&
      prevEpisode.hasAttribute('data-season_id') &&
      prevEpisode.hasAttribute('data-episode_id')
    ) {
      season = prevEpisode.getAttribute('data-season_id');
      episode = prevEpisode.getAttribute('data-episode_id');
    }
    if (season && episode) {
      return `Play previous episode S${ season }:E${ episode }`;
    }
    return 'No previous episode available';
  }

  function updateEpisodeButtons() {
    updateEpisodeButton(prevButton, getPreviousEpisodeElement, getPrevButtonTooltip);
    updateEpisodeButton(nextButton, getNextEpisodeElement, getNextButtonTooltip);
    const activeInfo = getActiveEpisodeInfo();
    updatePlayButtonTooltip(activeInfo);
    handleCastingEpisodeChange(activeInfo);
    syncZoomWithStorage();
    attachObserverToActive();
  }

  function updateEpisodeButton(button, getEpisodeFn, tooltipFn) {
    if (!button) return;
    const episode = getEpisodeFn();
    const tooltip = tooltipFn(episode);
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
    const isDisabled = !episode;
    button.classList.toggle('is-disabled', isDisabled);
    if (isDisabled) {
      button.dataset.isHovered = 'false';
    }
    updateButtonBackground(button);
  }

  function getNextEpisodeElement() {
    const activeEpisode = document.querySelector('.b-simple_episode__item.active');
    if (!activeEpisode) return null;

    let nextEpisode = activeEpisode.nextElementSibling;
    if (!nextEpisode) {
      const currentSeasonList = activeEpisode.parentElement;
      const nextSeasonList = currentSeasonList && currentSeasonList.nextElementSibling;
      if (nextSeasonList && nextSeasonList.classList.contains('b-simple_episodes__list')) {
        nextSeasonList.style.display = 'block';
        currentSeasonList.style.display = 'none';
        nextEpisode = nextSeasonList.querySelector('.b-simple_episode__item');
      }
    }
    return nextEpisode && nextEpisode.classList.contains('b-simple_episode__item') ? nextEpisode : null;
  }

  function getPreviousEpisodeElement() {
    const activeEpisode = document.querySelector('.b-simple_episode__item.active');
    if (!activeEpisode) return null;

    let prevEpisode = activeEpisode.previousElementSibling;
    if (!prevEpisode) {
      const currentSeasonList = activeEpisode.parentElement;
      const prevSeasonList = currentSeasonList && currentSeasonList.previousElementSibling;
      if (prevSeasonList && prevSeasonList.classList.contains('b-simple_episodes__list')) {
        prevSeasonList.style.display = 'block';
        currentSeasonList.style.display = 'none';
        const episodes = prevSeasonList.querySelectorAll('.b-simple_episode__item');
        prevEpisode = episodes[episodes.length - 1] || null;
      }
    }
    return prevEpisode && prevEpisode.classList.contains('b-simple_episode__item') ? prevEpisode : null;
  }

  function getActiveEpisodeInfo() {
    const activeEpisode = document.querySelector('.b-simple_episode__item.active');
    if (!activeEpisode) return null;
    const season = activeEpisode.getAttribute('data-season_id');
    const episode = activeEpisode.getAttribute('data-episode_id');
    if (!season || !episode) return null;
    return { season, episode };
  }

  function formatEpisodeLabel(info) {
    if (!info || !info.season || !info.episode) return null;
    return `S${ info.season }:E${ info.episode }`;
  }

  function updatePlayButtonTooltip(activeInfo = getActiveEpisodeInfo()) {
    const playElement = getPlayButtonElement();
    if (!playElement) return;
    const label = formatEpisodeLabel(activeInfo || getActiveEpisodeInfo());
    if (!label) return;
    if (playElement.title !== label) {
      playElement.title = label;
    }
    if (playElement.getAttribute('aria-label') !== label) {
      playElement.setAttribute('aria-label', label);
    }
  }

  function navigateToPreviousEpisode() {
    const prevEpisode = getPreviousEpisodeElement();
    if (prevEpisode) {
      const targetKey = `${ prevEpisode.getAttribute('data-season_id') || 's' }-${ prevEpisode.getAttribute('data-episode_id') }`;
      console.log(LOG_PREFIX, 'going prev', {
        from: formatEpisodeLabel(getActiveEpisodeInfo()),
        to: formatEpisodeLabel({ season: prevEpisode.getAttribute('data-season_id'), episode: prevEpisode.getAttribute('data-episode_id') }),
        url: getCurrentMediaUrl(),
        cached: episodeMediaCache[targetKey] || null
      });
      pendingEpisodeKey = targetKey;
      lastEpisodeNavTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      prevEpisode.click();
      setTimeout(updateEpisodeButtons, 2000);
      setTimeout(startEpisodePlayback, 2000);
      setTimeout(scheduleCastReload, 3000);
    }
  }

  function navigateToNextEpisode() {
    const nextEpisode = getNextEpisodeElement();
    if (nextEpisode) {
      const targetKey = `${ nextEpisode.getAttribute('data-season_id') || 's' }-${ nextEpisode.getAttribute('data-episode_id') }`;
      console.log(LOG_PREFIX, 'going next', {
        from: formatEpisodeLabel(getActiveEpisodeInfo()),
        to: formatEpisodeLabel({ season: nextEpisode.getAttribute('data-season_id'), episode: nextEpisode.getAttribute('data-episode_id') }),
        url: getCurrentMediaUrl(),
        cached: episodeMediaCache[targetKey] || null
      });
      pendingEpisodeKey = targetKey;
      lastEpisodeNavTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      nextEpisode.click();
      setTimeout(updateEpisodeButtons, 2000);
      setTimeout(startEpisodePlayback, 2000);
      setTimeout(scheduleCastReload, 3000);
    }
  }

  function startEpisodePlayback() {
    const player = document.getElementById('oframecdnplayer');
    if (!player) return;
    const descendants = player.childNodes;
    const startButton = descendants[7] && descendants[7].firstChild && descendants[7].firstChild.firstChild;
    if (startButton) {
      startButton.click();
    }
  }

  function createEpisodeButton(id, iconSvg, handler) {
    const button = document.createElement('pjsdiv');
    button.id = id;
    button.innerHTML = iconSvg;
    button.dataset.isHovered = 'false';
    button.setAttribute('aria-label', '');
    button.addEventListener('click', handler);
    return button;
  }

  function mountEpisodeButton(button) {
    const playerElement = document.getElementById('oframecdnplayer');
    if (playerElement) {
      playerElement.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    applyButtonStyles(undefined, button);
  }

  function createPrevButton() {
    prevButton = createEpisodeButton('prev-episode-button', PREV_ICON_SVG, navigateToPreviousEpisode);
    mountEpisodeButton(prevButton);
  }

  function createNextButton() {
    nextButton = createEpisodeButton('next-episode-button', NEXT_ICON_SVG, navigateToNextEpisode);
    mountEpisodeButton(nextButton);
  }

  function createZoomButton(id, label, tooltip, handler) {
    const button = document.createElement('pjsdiv');
    button.id = id;
    button.textContent = label;
    button.dataset.isHovered = 'false';
    button.dataset.tooltipBase = tooltip;
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (button.classList.contains('is-disabled')) return;
      handler();
    });
    return button;
  }

  function createZoomButtons() {
    zoomOutButton = createZoomButton('zoom-out-button', '▬', 'Zoom video out', () => adjustVideoZoom(-ZOOM_STEP));
    zoomResetButton = createZoomButton('zoom-reset-button', 'Z-Reset', 'Reset zoom', () => setVideoZoom(1));
    zoomInButton = createZoomButton('zoom-in-button', '✚', 'Zoom video in', () => adjustVideoZoom(ZOOM_STEP));
    [zoomOutButton, zoomResetButton, zoomInButton].forEach((button) => mountEpisodeButton(button));
    updateZoomButtonsState();
    refreshZoomTooltips();
  }

  function getControlledButtons() {
    return [prevButton, nextButton, zoomOutButton, zoomResetButton, zoomInButton, castToggleButton].filter(Boolean);
  }

  function getVideoElement() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return null;
    return playerElement.querySelector('video');
  }

  function clampZoom(value) {
    if (Number.isNaN(value)) return currentZoomLevel;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function applyZoomToVideoElement() {
    const video = getVideoElement();
    if (!video) return;
    video.style.transformOrigin = 'center center';
    video.style.transition = video.style.transition || 'transform 0.15s ease-out';
    video.style.transform = `scale(${ currentZoomLevel })`;
  }

  function formatZoomValue(value) {
    const normalized = Number.isFinite(value) ? value : 1;
    return `${ normalized.toFixed(2) }x`;
  }

  function refreshZoomTooltips() {
    const zoomLabel = formatZoomValue(currentZoomLevel);
    [zoomOutButton, zoomResetButton, zoomInButton].forEach((button) => {
      if (!button) return;
      const base = button.dataset.tooltipBase || '';
      const fullLabel = base ? `${ base } (${ zoomLabel })` : zoomLabel;
      button.title = fullLabel;
      button.setAttribute('aria-label', fullLabel);
    });
  }

  function getShowIdentifier() {
    const path = window.location && window.location.pathname ? window.location.pathname : '';
    if (!path) return null;
    const cleaned = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    return cleaned || null;
  }

  function getZoomStorageKey() {
    const showIdentifier = getShowIdentifier();
    const episodeInfo = getActiveEpisodeInfo();
    if (!showIdentifier || !episodeInfo || !episodeInfo.season) {
      return null;
    }
    return `${ ZOOM_COOKIE_PREFIX }${ showIdentifier }_s${ episodeInfo.season }`;
  }

  function readCookieValue(name) {
    if (!name || !document.cookie) return null;
    const cookies = document.cookie.split(';');
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(`${ name }=`)) {
        return decodeURIComponent(cookie.substring(name.length + 1));
      }
    }
    return null;
  }

  function writeCookieValue(name, value) {
    if (!name) return;
    const encodedValue = encodeURIComponent(String(value));
    document.cookie = `${ name }=${ encodedValue }; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
  }

  function persistCurrentZoom() {
    const key = getZoomStorageKey() || activeZoomStorageKey;
    if (!key) return;
    activeZoomStorageKey = key;
    writeCookieValue(key, currentZoomLevel);
  }

  function syncZoomWithStorage() {
    const key = getZoomStorageKey();
    if (!key) return;
    if (activeZoomStorageKey === key) return;
    activeZoomStorageKey = key;
    const savedValue = readCookieValue(key);
    const parsed = savedValue !== null ? parseFloat(savedValue) : NaN;
    if (Number.isFinite(parsed)) {
      setVideoZoom(parsed, { persist: false });
    } else {
      setVideoZoom(1, { persist: false });
    }
  }

  function setVideoZoom(nextValue, options = {}) {
    const { persist = true } = options;
    const clamped = clampZoom(nextValue);
    currentZoomLevel = parseFloat(clamped.toFixed(ZOOM_PRECISION));
    applyZoomToVideoElement();
    updateZoomButtonsState();
    refreshZoomTooltips();
    if (persist) {
      persistCurrentZoom();
    }
  }

  function adjustVideoZoom(delta) {
    setVideoZoom(currentZoomLevel + delta);
  }

  function updateZoomButtonsState() {
    const atMin = currentZoomLevel <= MIN_ZOOM + Number.EPSILON;
    const atMax = currentZoomLevel >= MAX_ZOOM - Number.EPSILON;
    if (zoomOutButton) {
      zoomOutButton.classList.toggle('is-disabled', atMin);
      if (atMin) {
        zoomOutButton.dataset.isHovered = 'false';
      }
    }
    if (zoomInButton) {
      zoomInButton.classList.toggle('is-disabled', atMax);
      if (atMax) {
        zoomInButton.dataset.isHovered = 'false';
      }
    }
    if (zoomResetButton) {
      zoomResetButton.classList.remove('is-disabled');
    }
  }

  function findPlayerInstance() {
    const seen = new Set();
    const queue = [window];
    while (queue.length) {
      const win = queue.shift();
      if (!win || seen.has(win)) continue;
      seen.add(win);
      try {
        if (win.pljssglobal && Array.isArray(win.pljssglobal) && win.pljssglobal[0]) {
          return win.pljssglobal[0];
        }
      } catch (error) {
        // ignore cross-origin
      }
      try {
        const frames = win.frames;
        for (let i = 0; i < frames.length; i += 1) {
          queue.push(frames[i]);
        }
      } catch (error) {
        // ignore
      }
    }
    return null;
  }

  function getPlayerApi() {
    const instance = findPlayerInstance();
    return instance && typeof instance.api === 'function' ? instance.api : null;
  }

  function getCurrentMediaUrl() {
    const api = getPlayerApi();
    const candidates = [];
    const addCandidate = (url, source, ts) => {
      if (url && typeof url === 'string') {
        const nowTs = typeof ts === 'number'
          ? ts
          : (typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Date.now());
        candidates.push({ url, source, ts: nowTs });
      }
    };
    const extractSeasonEpisodeFromUrl = (url) => {
      if (!url || typeof url !== 'string') return null;
      try {
        const parts = url.split('/');
        for (let i = parts.length - 1; i >= 1; i -= 1) {
          if (parts[i].includes('.mp4:hls:manifest')) {
            const prev = parts[i - 1];
            const prevSeason = parts[i - 2];
            if (prev && /^\d+$/.test(prev)) {
              return {
                season: prevSeason && /^\d+$/.test(prevSeason) ? prevSeason : null,
                episode: prev
              };
            }
          }
        }
      } catch (error) {
        // ignore
      }
      return null;
    };

    const pickBest = () => {
      const active = getActiveEpisodeInfo();
      const activeEpisode = active && active.episode ? String(active.episode) : null;
      const activeSeason = active && active.season ? String(active.season) : null;
      const activeKey = activeEpisode ? `${ activeSeason || 's' }-${ activeEpisode }` : null;
      const targetKey = activeKey || pendingEpisodeKey;
      if (targetKey && episodeMediaCache[targetKey] && episodeMediaCache[targetKey].url) {
        return episodeMediaCache[targetKey];
      }
      const minTs = lastEpisodeNavTs || 0;
      const httpCandidates = candidates.filter((c) => c.url.startsWith('http') && !c.url.startsWith('blob:'));
      const withEpisode = activeEpisode
        ? httpCandidates.filter((c) => {
            const info = extractSeasonEpisodeFromUrl(c.url);
            if (!info || !info.episode) return false;
            if (info.episode !== activeEpisode) return false;
            if (activeSeason && info.season && info.season !== activeSeason) return false;
            return true;
          })
        : [];
      let pool = withEpisode.length > 0 ? withEpisode : httpCandidates;
      if (pool.length > 0) {
        const filtered = pool.filter((c) => !minTs || !c.ts || c.ts >= minTs - 500);
        if (filtered.length > 0) {
          pool = filtered;
        }
        pool.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return pool[0];
      }
      return candidates[0] || null;
    };

    if (api) {
      try {
        const file = api('file');
        if (file) {
          if (Array.isArray(file) && file.length > 0 && typeof file[0] === 'string') {
            addCandidate(file[0], 'api:file[0]');
          } else if (typeof file === 'string') {
            addCandidate(file, 'api:file');
          }
        }
      } catch (error) {
        // ignore
      }
      try {
        const playlist = api('playlist');
        const pid = api('playlist_id');
        if (playlist && Array.isArray(playlist)) {
          if (pid && playlist[pid] && playlist[pid].file) {
            addCandidate(playlist[pid].file, 'api:playlist[id]');
          }
          for (const entry of playlist) {
            if (!entry) continue;
            if (entry.file) addCandidate(entry.file, 'api:playlist:file');
            if (entry.url) addCandidate(entry.url, 'api:playlist:url');
            if (entry.src) addCandidate(entry.src, 'api:playlist:src');
            if (entry.sources && Array.isArray(entry.sources)) {
              for (const s of entry.sources) {
                if (s && (s.file || s.url || typeof s === 'string')) {
                  addCandidate(s.file || s.url || s, 'api:playlist:sources');
                }
              }
            }
          }
        }
      } catch (error) {
        // ignore
      }
    }

    const video = getVideoElement();
    if (video) {
      if (video.currentSrc) addCandidate(video.currentSrc, 'video:currentSrc');
      if (video.src) addCandidate(video.src, 'video:src');
      const sourceChild = video.querySelector('source');
      if (sourceChild && sourceChild.src) {
        addCandidate(sourceChild.src, 'video:source');
      }
    }

    try {
      const perfEntries = performance.getEntriesByType('resource') || [];
      perfEntries.forEach((entry) => {
        if (entry && entry.name && typeof entry.name === 'string' && entry.name.includes('manifest.m3u8')) {
          addCandidate(entry.name, 'perf:manifest', entry.startTime || Date.now());
        }
      });
    } catch (error) {
      // ignore
    }

    const best = pickBest();
    const updateCache = () => {
      candidates.forEach((c) => {
        const info = extractSeasonEpisodeFromUrl(c.url);
        if (!info || !info.episode) return;
        const key = `${ info.season || 's' }-${ info.episode }`;
        const prev = episodeMediaCache[key];
        if (!prev || (c.ts || 0) > (prev.ts || 0)) {
          episodeMediaCache[key] = { ...c };
        }
      });
      if (best) {
        const active = getActiveEpisodeInfo();
        if (active && active.episode) {
          const key = `${ active.season || 's' }-${ active.episode }`;
          const prev = episodeMediaCache[key];
          if (!prev || (best.ts || 0) >= (prev.ts || 0)) {
            episodeMediaCache[key] = { ...best };
          }
        }
      }
      try {
        window.__hdrezkaMediaCache = episodeMediaCache;
      } catch (error) {
        // ignore
      }
    };
    updateCache();
    return best ? { ...best, candidates } : { url: null, source: null, candidates };
  }

  function injectCastHelper() {
    if (castHelperInjected) return;
    if (!chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') return;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('recast_helper.js');
    script.async = false;
    script.onload = () => {
      castHelperReady = true;
    };
    script.onerror = () => {
      castHelperReady = false;
    };
    const target =
      document.documentElement ||
      document.head ||
      document.body;
    if (!target) return;
    castHelperInjected = true;
    target.appendChild(script);
  }

  function postCastControl(action, payload = {}) {
    if (!action) return false;
    try {
      window.postMessage(
        {
          type: 'hdrezka_cast_control',
          action,
          ...payload
        },
        '*'
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureCastInitialized(force = false) {
    const api = getPlayerApi();
    if (!api) return false;
    if (castInitRequested && !force) return true;
    castInitRequested = true;
    try {
      api('castinit');
      return true;
    } catch (error) {
      return false;
    }
  }

  function getCastContext() {
    if (!window.cast || !cast.framework || !cast.framework.CastContext) {
      return null;
    }
    return cast.framework.CastContext.getInstance();
  }

  function getCastSessionState() {
    const context = getCastContext();
    if (!context || typeof context.getSessionState !== 'function') {
      return null;
    }
    return context.getSessionState();
  }

  function getNativeCastState() {
    const btn = findNativeCastButton();
    if (!btn) return null;
    const connected = btn.querySelector('.cast_caf_state_c');
    const disconnected = btn.querySelector('.cast_caf_state_d');
    if (connected) return 'connected';
    if (disconnected) return 'disconnected';
    return null;
  }

  function isCastSessionActive() {
    const state = computeCastState();
    if (castBridgeState !== state) {
      castBridgeState = state;
      updateCastButtonState();
    }
    return state;
  }

  function findNativeCastButton() {
    return document.querySelector('#pjs_cast_button_cdnplayer, google-cast-button, button[is="google-cast-button"]');
  }

  function updateCastButtonState() {
    if (!castToggleButton) return;
    const context = getCastContext();
    const nativeButton = findNativeCastButton();
    const hasFramework = Boolean(context || nativeButton);
    const casting = hasFramework && isCastSessionActive();
    const tooltip = casting ? 'Stop casting' : 'Start casting';
    castToggleButton.innerHTML = casting ? CAST_ICON_SVG_ACTIVE : CAST_ICON_SVG;
    castToggleButton.title = tooltip;
    castToggleButton.setAttribute('aria-label', tooltip);
    castToggleButton.classList.toggle('is-disabled', !hasFramework);
    if (!hasFramework) {
      castToggleButton.dataset.isHovered = 'false';
    }
  }

  function handleCastToggle(event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (!castToggleButton || castToggleButton.classList.contains('is-disabled')) {
      return;
    }

    ensureCastInitialized(true);
    let context = getCastContext();
    if (context) {
      const active = isCastSessionActive();
      if (active && typeof context.endCurrentSession === 'function') {
        try {
          context.endCurrentSession(true);
        } catch (error) {
          // ignore
        }
      } else if (typeof context.requestSession === 'function') {
        context.requestSession().catch(() => updateCastButtonState());
      }
      return;
    }

    const nativeButton = findNativeCastButton();
    if (nativeButton) {
      nativeButton.click();
      return;
    }

    context = getCastContext();
    if (context && typeof context.requestSession === 'function') {
      context.requestSession().catch(() => updateCastButtonState());
    } else {
      updateCastButtonState();
    }
  }

  function attemptCastReload(attempt = 0, options = {}) {
    const { seekToStart = false } = options;
    if (!isCastSessionActive()) return;
    injectCastHelper();
    ensureCastInitialized(true);
    const playerInstance = (window.pljssglobal && window.pljssglobal[0]) || null;
    const api = getPlayerApi();
    let triggered = false;

    const bridgePosted = postCastControl('recast');
    const bridgeSeek = seekToStart ? postCastControl('seekPercent', { percent: 0 }) : false;
    if (castHelperReady && (bridgePosted || bridgeSeek)) {
      triggered = true;
    }

    if (playerInstance && playerInstance.chromecast && typeof playerInstance.chromecast.Go === 'function') {
      try {
        playerInstance.chromecast.Go();
        triggered = true;
      } catch (error) {
        // ignore
      }
    }
    if (api) {
      try {
        api('seek', 0);
        api('play');
        triggered = true;
      } catch (error) {
        // ignore
      }
    }
    const nextAttempt = attempt + 1;
    if (!triggered && nextAttempt < CAST_RESUME_MAX_ATTEMPTS) {
      setTimeout(() => attemptCastReload(nextAttempt, options), CAST_RESUME_DELAY_MS);
    }
  }

  function scheduleCastReload() {
    if (!isCastSessionActive()) return;
    injectCastHelper();
    if (castReloadTimer) {
      clearTimeout(castReloadTimer);
      castReloadTimer = null;
    }
    const startedAt = Date.now();
    let attempt = 0;
    const run = () => {
      if (!isCastSessionActive()) {
        castReloadTimer = null;
        return;
      }
      const media = getCurrentMediaUrl();
      console.log(LOG_PREFIX, 'reload attempt', {
        attempt,
        url: media ? media.url : null,
        source: media ? media.source : null,
        candidates: media ? media.candidates : null,
        episode: formatEpisodeLabel(getActiveEpisodeInfo())
      });
      if (media && Array.isArray(media.candidates)) {
        console.log(LOG_PREFIX, 'candidates detail', media.candidates);
      }
      // debug: dump player media/playlist
      try {
        const inst = findPlayerInstance();
        console.log(LOG_PREFIX, 'player media', { inst });
        if (inst) {
          console.log(LOG_PREFIX, 'player media', {
            media: inst.media,
            playlist: inst.playlist,
            apiPlaylist: getPlayerApi() ? getPlayerApi()('playlist') : null
          });
        } else {
          console.log(LOG_PREFIX, 'player media', { inst: null });
        }
      } catch (error) {
        console.log(LOG_PREFIX, 'player media read failed', error);
      }
      window.postMessage({ type: 'hdrezka_frame_media_request' }, '*');
      postCastControl('dumpMedia', { reply: true });
      postCastControl('stopCast');
      postCastControl('loadCurrent', { url: media ? media.url : undefined, candidates: media ? media.candidates : undefined });
      attemptCastReload(attempt, { seekToStart: true });
      attempt += 1;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= CAST_RELOAD_WINDOW_MS || attempt >= CAST_RESUME_MAX_ATTEMPTS) {
        castReloadTimer = null;
        return;
      }
      castReloadTimer = setTimeout(run, CAST_RESUME_DELAY_MS);
    };
    castReloadTimer = setTimeout(run, 800);
  }

  function handleCastingEpisodeChange(activeInfo) {
    const key = activeInfo && activeInfo.season && activeInfo.episode ? `${ activeInfo.season }-${ activeInfo.episode }` : null;
    if (key) {
      pendingEpisodeKey = key;
    }
    if (key && key !== lastEpisodeKey) {
      lastEpisodeKey = key;
      resetAutoAdvanceState();
      if (isCastSessionActive()) {
        scheduleCastReload();
      }
    } else if (!key) {
      lastEpisodeKey = null;
      resetAutoAdvanceState();
    }
  }

  function handleCastStateChange() {
    updateCastButtonState();
  }

  function attachCastSessionListener() {
    const context = getCastContext();
    if (!context || castSessionListenerAttached) return;
    if (!window.cast || !cast.framework || !cast.framework.CastContextEventType) return;
    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, handleCastStateChange);
    context.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, handleCastStateChange);
    context.addEventListener(cast.framework.CastContextEventType.SESSION_ENDED, handleCastStateChange);
    castSessionListenerAttached = true;
  }

  function getPlaybackTimes() {
    const api = getPlayerApi();
    const instance = window.pljssglobal && window.pljssglobal[0];
    const chromecast = instance && instance.chromecast ? instance.chromecast : null;
    const timelineInfo = readTimelineProgress();
    const logBase = timelineInfo ? { timeline: timelineInfo } : {};

    // When casting, prefer the chromecast time/duration helpers if available.
    if (isCastSessionActive() && chromecast) {
      try {
        const time = Number(chromecast.Time ? chromecast.Time() : NaN);
        const duration = Number(chromecast.Duration ? chromecast.Duration() : NaN);
        if (Number.isFinite(time) && Number.isFinite(duration)) {
          return { time, duration, ratio: duration > 0 ? time / duration : null };
        }
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'chromecast time read failed', error);
      }
    }

    let time = null;
    let duration = null;
    if (api) {
      try {
        time = Number(api('time'));
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'api time read failed', error);
      }
      try {
        duration = Number(api('duration'));
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'api duration read failed', error);
      }
    }

    const durationValid = Number.isFinite(duration) && duration > 0;
    const timeValid = Number.isFinite(time) && time >= 0;
    const ratioFromTimeline = timelineInfo && timelineInfo.total > 0 ? timelineInfo.elapsed / timelineInfo.total : null;

    if ((!timeValid || !durationValid) && ratioFromTimeline !== null) {
      if (durationValid) {
        time = Math.max(0, Math.min(duration, duration * ratioFromTimeline));
      } else if (timeValid) {
        duration = time / Math.max(ratioFromTimeline, 0.0001);
      }
    }

    if (!Number.isFinite(time) || !Number.isFinite(duration)) {
      if (ratioFromTimeline !== null) {
        return { time: null, duration: null, ratio: ratioFromTimeline };
      }
      return null;
    }
    return { time, duration, ratio: duration > 0 ? time / duration : null };
  }

  function readTimelineProgress() {
    const timeline = document.getElementById('cdnplayer_control_timeline');
    if (!timeline) return null;
    const all = Array.from(timeline.querySelectorAll('pjsdiv'));
    const candidate = all.find((el) => el.children && el.children.length >= 3);
    if (!candidate) return null;
    const bars = Array.from(candidate.children);
    if (bars.length < 3) return null;
    const total = bars[0].getBoundingClientRect().width || 0;
    const elapsed = bars[2].getBoundingClientRect().width || 0;
    return { total, elapsed };
  }

  function seekViaTimeline(ratio = 0) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const api = getPlayerApi();
    const instance = window.pljssglobal && window.pljssglobal[0];
    const chromecast = instance && instance.chromecast ? instance.chromecast : null;
    if (chromecast && isCastSessionActive()) {
      try {
        const duration = Number(api ? api('duration') : NaN);
        const targetTime = Number.isFinite(duration) ? duration * clamped : null;
        if (targetTime !== null) {
          chromecast.Seek(targetTime);
          chromecast.Play();
          console.log(AUTO_LOG_PREFIX, 'seekViaTimeline via chromecast', { ratio: clamped, targetTime, duration });
          return true;
        }
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'seekViaTimeline chromecast failed', error);
      }
    }
    if (api) {
      try {
        const percent = Math.round(clamped * 100);
        api('seek', `${ percent }%`);
        api('play');
        console.log(AUTO_LOG_PREFIX, 'seekViaTimeline via api %', { ratio: clamped, percent });
        return true;
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'seekViaTimeline api percent failed', error);
      }
    }
    if (api) {
      try {
        const duration = Number(api('duration'));
        if (Number.isFinite(duration) && duration > 0) {
          const targetTime = duration * clamped;
          api('seek', targetTime);
          api('play');
          console.log(AUTO_LOG_PREFIX, 'seekViaTimeline via api', { ratio: clamped, duration, targetTime });
          return true;
        }
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'seekViaTimeline api failed', error);
      }
    }

    const timeline = document.getElementById('cdnplayer_control_timeline');
    if (!timeline) {
      console.log(AUTO_LOG_PREFIX, 'timeline not found for seek');
      return false;
    }
    const targets = [timeline].concat(
      Array.from(timeline.querySelectorAll('*')).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.pointerEvents !== 'none';
      })
    );
    const dispatch = (type, Ctor = MouseEvent, init = {}) => {
      const evt = new Ctor(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: init.clientX,
        clientY: init.clientY,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
        ...init
      });
      init.target.dispatchEvent(evt);
    };
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + clamped * rect.width;
      const y = rect.top + rect.height / 2;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      ['pointermove', 'pointerdown', 'pointerup', 'mousemove', 'mousedown', 'mouseup', 'click'].forEach((type) => {
        const ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        dispatch(type, ctor, { clientX: x, clientY: y, target: el });
      });
    });
    return true;
  }

  // Bridge for console debugging from the page context.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'hdrezka_seek_timeline') {
      seekViaTimeline(typeof data.ratio === 'number' ? data.ratio : 0);
    } else if (data.type === 'hdrezka_cdn_stream') {
      const season = data.season || null;
      const episode = data.episode || null;
      const key = season && episode ? `${ season }-${ episode }` : null;
      const urls = Array.isArray(data.urls) ? data.urls : [];
      const chosenUrl = data.url || urls[0] || null;
      if (key && chosenUrl) {
        const ts = typeof data.ts === 'number' ? data.ts : Date.now();
        pendingEpisodeKey = key;
        episodeMediaCache[key] = {
          url: chosenUrl,
          source: 'cdn:init',
          ts,
          candidates: urls.map((u) => ({ url: u, source: 'cdn:init', ts }))
        };
        try {
          window.__hdrezkaMediaCache = episodeMediaCache;
        } catch (error) {
          // ignore
        }
        console.log(LOG_PREFIX, 'cdn stream update', { key, url: chosenUrl, urls, ts });
      }
    }
    if (data.type === 'hdrezka_cast_control_ack' && data.action === 'dumpMedia') {
      console.log(LOG_PREFIX, 'dumpMedia ack', data.ok);
    }
    if (data.type === 'hdrezka_frame_media_response') {
      console.log(LOG_PREFIX, 'frame media response', data.payload);
    }
  });


  function resetAutoAdvanceState() {
    autoAdvanceState.phase = 'idle';
    autoAdvanceState.key = null;
    autoAdvanceState.lastTime = 0;
    autoAdvanceState.lastRatio = 0;
    autoAdvanceState.waitStartUntil = 0;
    autoAdvanceState.waitPlayUntil = 0;
    autoAdvanceState.ensureAttempts = 0;
    // console.log(AUTO_LOG_PREFIX, 'state reset');
  }

  function maybeAutoAdvanceCast() {
    if (!isCastSessionActive()) {
      resetAutoAdvanceState();
      try {
        window.__hdrezkaAutoState = { casting: false, reason: 'not_casting' };
      } catch (error) {
        // ignore
      }
      // console.log(AUTO_LOG_PREFIX, 'casting not active, reset');
      return;
    }

    const info = getActiveEpisodeInfo();
    const key = info && info.season && info.episode ? `${ info.season }-${ info.episode }` : null;
    if (!key) {
      resetAutoAdvanceState();
      try {
        window.__hdrezkaAutoState = { casting: true, reason: 'no-active-key' };
      } catch (error) {
        // ignore
      }
      // console.log(AUTO_LOG_PREFIX, 'no active episode key');
      return;
    }
    if (autoAdvanceState.key && autoAdvanceState.key !== key) {
      resetAutoAdvanceState();
      // console.log(AUTO_LOG_PREFIX, 'episode changed, reset state', { key });
    }
    autoAdvanceState.key = key;

    const nextEpisode = getNextEpisodeElement();
    if (!nextEpisode) {
      try {
        window.__hdrezkaAutoState = { casting: true, key, reason: 'no-next-episode' };
      } catch (error) {
        // ignore
      }
      // console.log(AUTO_LOG_PREFIX, 'no next episode', { key });
      autoAdvanceState.phase = 'idle';
      return;
    }

    const times = getPlaybackTimes();
    if (!times) {
      try {
        window.__hdrezkaAutoState = { casting: true, key, reason: 'no-times' };
      } catch (error) {
        // ignore
      }
      // console.log(AUTO_LOG_PREFIX, 'no playback times', { key });
      autoAdvanceState.phase = 'idle';
      return;
    }

    const remaining = Number.isFinite(times.duration) && Number.isFinite(times.time)
      ? times.duration - times.time
      : null;
    const ratio = times.ratio !== null && times.ratio !== undefined
      ? times.ratio
      : (Number.isFinite(times.time) && Number.isFinite(times.duration) && times.duration > 0
          ? times.time / times.duration
          : null);
    const now = Date.now();
    try {
      window.__hdrezkaAutoState = {
        casting: true,
        key,
        phase: autoAdvanceState.phase,
        remaining,
        duration: times.duration,
        time: times.time,
        ratio,
        waitStartUntil: autoAdvanceState.waitStartUntil,
        waitPlayUntil: autoAdvanceState.waitPlayUntil,
        ensureAttempts: autoAdvanceState.ensureAttempts
      };
    } catch (error) {
      // ignore
    }

    const nearEnd =
      (remaining !== null && remaining <= AUTO_CAST_PREP_OFFSET_SEC) ||
      (ratio !== null && ratio >= AUTO_CAST_NEAR_END_RATIO);

    if (autoAdvanceState.phase === 'idle') {
      if (nearEnd)
      {
        autoAdvanceState.phase = 'waiting_start';
        autoAdvanceState.lastTime = Number.isFinite(times.time) ? times.time : 0;
        autoAdvanceState.lastRatio = Number.isFinite(ratio) ? ratio : 0;
        autoAdvanceState.waitStartUntil = now + AUTO_CAST_SEEK_DELAY_MS + 800;
        const usedTimeline = seekViaTimeline(0.001);
        if (!usedTimeline)
        {
          const api = getPlayerApi();
          if (api)
          {
            try
            {
              api('seek', 1);
              api('play');
              console.log(AUTO_LOG_PREFIX, 'fallback api seek', { key });
            } catch (error)
            {
              // ignore
            }
          }
        }
        console.log(AUTO_LOG_PREFIX, 'prep->waiting_start', {
          key,
          time: times.time,
          duration: times.duration,
          remaining,
          ratio,
          usedTimeline
        });
      }
      else if ((ratio !== null && (ratio + 0.02) >= AUTO_CAST_NEAR_END_RATIO) || ratio % 0.1 < 0.01 || ratio % 0.1 > 0.09)
      {
        console.log(AUTO_LOG_PREFIX, 'not nearEnd', { nearEnd,  ratio, remaining, key  });
      }
      return;
    }

    if (autoAdvanceState.phase === 'waiting_start') {
      const timeProgressed =
        Number.isFinite(times.time) && Number.isFinite(autoAdvanceState.lastTime)
          ? times.time > autoAdvanceState.lastTime + 0.25
          : false;
      const ratioProgressed =
        Number.isFinite(ratio) && Number.isFinite(autoAdvanceState.lastRatio)
          ? ratio > autoAdvanceState.lastRatio + 0.001
          : false;
      const progressed = timeProgressed || ratioProgressed;
      if (progressed || now >= autoAdvanceState.waitStartUntil) {
        autoAdvanceState.phase = 'ensure_play';
        autoAdvanceState.waitPlayUntil = now + AUTO_CAST_PLAY_DELAY_MS;
        autoAdvanceState.ensureAttempts = 0;
        const beforeNextTimeline = seekViaTimeline(0.001);
        navigateToNextEpisode();
        console.log(AUTO_LOG_PREFIX, 'waiting_start->ensure_play', {
          progressed,
          timeProgressed,
          ratioProgressed,
          key,
          time: times.time,
          duration: times.duration,
          remaining,
          ratio,
          beforeNextTimeline
        });
        return;
      }
      autoAdvanceState.lastTime = Number.isFinite(times.time) ? times.time : autoAdvanceState.lastTime;
      autoAdvanceState.lastRatio = Number.isFinite(ratio) ? ratio : autoAdvanceState.lastRatio;
      return;
    }

    if (autoAdvanceState.phase === 'ensure_play') {
      const timeProgressed =
        Number.isFinite(times.time) && Number.isFinite(autoAdvanceState.lastTime)
          ? times.time > autoAdvanceState.lastTime + 0.25
          : false;
      const ratioProgressed =
        Number.isFinite(ratio) && Number.isFinite(autoAdvanceState.lastRatio)
          ? ratio > autoAdvanceState.lastRatio + 0.001
          : false;
      const progressed = timeProgressed || ratioProgressed;
      if (progressed) {
        console.log(AUTO_LOG_PREFIX, 'ensure_play complete', {
          key,
          time: times.time,
          duration: times.duration,
          ratio
        });
        resetAutoAdvanceState();
        return;
      }
      if (now >= autoAdvanceState.waitPlayUntil && autoAdvanceState.ensureAttempts < AUTO_CAST_MAX_RETRIES) {
        autoAdvanceState.ensureAttempts += 1;
        autoAdvanceState.waitPlayUntil = now + AUTO_CAST_PLAY_RETRY_MS;
        attemptCastReload();
        const api = getPlayerApi();
        if (api) {
          try {
            api('play');
          } catch (error) {
            // ignore
          }
        }
        console.log(AUTO_LOG_PREFIX, 'ensure_play retry', {
          attempt: autoAdvanceState.ensureAttempts,
          key,
          time: times.time,
          duration: times.duration,
          remaining,
          ratio
        });
      }
      if (autoAdvanceState.ensureAttempts >= AUTO_CAST_MAX_RETRIES && now >= autoAdvanceState.waitPlayUntil) {
        console.log(AUTO_LOG_PREFIX, 'ensure_play giving up', { key, time: times.time, duration: times.duration, ratio });
        resetAutoAdvanceState();
      }
    }
  }

  function syncCastIntegration() {
    ensureCastInitialized();
    attachCastSessionListener();
    pollCastState();
  }

  function pollCastState() {
    const nextState = computeCastState();
    if (castBridgeState !== nextState) {
      castBridgeState = nextState;
      updateCastButtonState();
    }
  }

  function computeCastState() {
    let casting = false;
    let ctxState = null;
    let nativeInfo = null;
    if (window.cast && cast.framework && cast.framework.CastContext) {
      try {
        const ctx = cast.framework.CastContext.getInstance();
        ctxState = ctx && ctx.getSessionState ? ctx.getSessionState() : null;
        if (ctxState && cast.framework.SessionState) {
          if (
            ctxState === cast.framework.SessionState.SESSION_STARTED ||
            ctxState === cast.framework.SessionState.SESSION_RESUMED ||
            ctxState === cast.framework.SessionState.SESSION_STARTING
          ) {
            casting = true;
          }
        }
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'cast context read failed', error);
      }
    }
    if (!casting) {
      try {
        const btn = findNativeCastButton();
        if (btn) {
          const connectedPath = btn.querySelector('.cast_caf_state_c');
          const disconnectedPath = btn.querySelector('.cast_caf_state_d');
          const display = getComputedStyle(btn).display;
          nativeInfo = {
            display,
            connected: !!connectedPath,
            disconnected: !!disconnectedPath,
            fill: connectedPath ? getComputedStyle(connectedPath).fill : null
          };
          if (connectedPath && display !== 'none') {
            casting = true;
          }
        }
      } catch (error) {
        console.log(AUTO_LOG_PREFIX, 'native cast read failed', error);
      }
    }
    // console.log(AUTO_LOG_PREFIX, 'cast state', { casting, ctxState, nativeInfo });
    return casting;
  }
  function createCastToggleButton() {
    castToggleButton = createEpisodeButton('cast-toggle-button', CAST_ICON_SVG, handleCastToggle);
    const tooltip = 'Start casting';
    castToggleButton.title = tooltip;
    castToggleButton.setAttribute('aria-label', tooltip);
    castToggleButton.dataset.minWidth = '32';
    castToggleButton.dataset.minHeight = '32';
    mountEpisodeButton(castToggleButton);
    updateCastButtonState();
  }

  function applyButtonStyles(controlInfo, targetButton = nextButton) {
    const button = targetButton || nextButton;
    if (!button) return;
    const info = controlInfo === undefined ? getPlayControlInfo() : controlInfo;
    const timelineColors = getTimelineColors();
    const baseColor = timelineColors.base;
    const hoverColor = timelineColors.hover;

    if (info && info.styles) {
      const styles = info.styles;
      if (styles.borderRadius && styles.borderRadius !== '0px') {
        const adjustedRadius = adjustBorderRadius(styles.borderRadius, 2);
        if (adjustedRadius) {
          button.style.borderRadius = adjustedRadius;
        }
      }
      if (styles.border && styles.border !== '0px none rgb(0, 0, 0)') {
        button.style.border = styles.border;
      }
      if (styles.boxShadow && styles.boxShadow !== 'none') {
        button.style.boxShadow = styles.boxShadow;
      }
      button.style.color = info.iconColor || '#fff';
    } else {
      button.style.borderRadius = '12px';
      button.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      button.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.4)';
      button.style.color = '#fff';
    }

    setButtonColors(button, baseColor, hoverColor);
  }

  function getGearContainer() {
    const settingsPanel = document.getElementById('cdnplayer_settings');
    if (!settingsPanel) return null;
    const gearElement = settingsPanel.parentElement ? settingsPanel.parentElement.previousElementSibling : null;
    return gearElement ? getPlayerChildFromNode(gearElement) : null;
  }

  function reserveTimelineSpace() {
    const timeline = document.getElementById('cdnplayer_control_timeline');
    if (timeline) {
      const buttons = getControlledButtons();
      const estimatedWidth = buttons.reduce((total, button, index) => {
        const width = parseFloat(button.style.width) || button.offsetWidth || 48;
        const margin = index === 0 ? 0 : BUTTON_MARGIN_PX;
        return total + width + margin;
      }, BUTTON_MARGIN_PX * 2);
      const padding = Math.max(TIMELINE_PADDING_PX, estimatedWidth);
      timeline.style.setProperty('padding-right', `${ padding }px`, 'important');
    }
  }

  function ensureAttached() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return;
    getControlledButtons().forEach((button) => {
      if (button && button.parentElement !== playerElement) {
        playerElement.appendChild(button);
      }
    });
  }

  function getPlayerChildFromNode(node) {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement || !node) return null;
    let current = node;
    while (current && current !== playerElement) {
      if (current.parentElement === playerElement) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getVolumeContainer() {
    const volumePath =
      document.getElementById('pjs_cdnplayercontrol_mutevolume_element1') ||
      document.getElementById('pjs_cdnplayercontrol_mutevolume_element2');
    return volumePath ? getPlayerChildFromNode(volumePath) : null;
  }

  function getPlayButtonElement() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return null;
    const playSvg = Array.from(playerElement.querySelectorAll('svg')).find((svg) =>
      svg.innerHTML.includes(PLAY_SVG_IDENTIFIER)
    );
    if (!playSvg) return null;
    const playWrapper = playSvg.closest('pjsdiv');
    if (!playWrapper) return null;

    const candidates = new Set();
    const collect = (node) => {
      if (node) {
        candidates.add(node);
        node.querySelectorAll && node.querySelectorAll('pjsdiv').forEach((child) => candidates.add(child));
      }
    };
    collect(playWrapper);
    collect(playWrapper.parentElement);
    collect(playWrapper.previousElementSibling);
    collect(playWrapper.parentElement ? playWrapper.parentElement.previousElementSibling : null);

    for (const candidate of candidates) {
      if (!candidate) continue;
      const rect = candidate.getBoundingClientRect();
      const styles = getComputedStyle(candidate);
      if (rect.width >= 20 && rect.height >= 20 && styles.pointerEvents !== 'none') {
        return candidate;
      }
    }

    return playWrapper;
  }

  function getPlayButtonRect() {
    const element = getPlayButtonElement();
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function getPlayControlInfo() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return null;
    const playSvg = Array.from(playerElement.querySelectorAll('svg')).find((svg) =>
      svg.innerHTML.includes(PLAY_SVG_IDENTIFIER)
    );
    if (!playSvg) return null;
    const playElement = getPlayButtonElement();
    if (!playElement) return null;
    const rect = playElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const styles = getComputedStyle(playElement);
    const shape = playSvg.querySelector('polyline, polygon, path');
    const iconColor = shape ? (shape.getAttribute('fill') || getComputedStyle(shape).fill) : null;
    return { element: playElement, rect, styles, iconColor };
  }

  function attachPlayButtonHover(element) {
    if (!element) return;
    if (observedPlayButton === element) return;
    detachPlayButtonHover();

    const onEnter = () => {
      requestAnimationFrame(() => {
        const color = extractColor(getComputedStyle(element).backgroundColor);
        if (color) {
          getControlledButtons().forEach((button) => {
            if (button) {
              button.dataset.nextButtonHoverColor = color;
              updateButtonBackground(button);
            }
          });
        }
      });
    };

    const onLeave = () => {
      requestAnimationFrame(() => {
        const color = extractColor(getComputedStyle(element).backgroundColor);
        if (color) {
          getControlledButtons().forEach((button) => {
            if (button) {
              button.dataset.nextButtonBaseColor = color;
              updateButtonBackground(button);
            }
          });
        }
      });
    };

    element.addEventListener('mouseenter', onEnter);
    element.addEventListener('mouseleave', onLeave);
    playButtonHoverHandlers = { onEnter, onLeave };
    observedPlayButton = element;
    onLeave();
  }

  function detachPlayButtonHover() {
    if (observedPlayButton && playButtonHoverHandlers) {
      observedPlayButton.removeEventListener('mouseenter', playButtonHoverHandlers.onEnter);
      observedPlayButton.removeEventListener('mouseleave', playButtonHoverHandlers.onLeave);
    }
    observedPlayButton = null;
    playButtonHoverHandlers = null;
  }

  function extractColor(rawColor) {
    if (!rawColor || rawColor === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    return rawColor;
  }

  function getTimelineColors() {
    const timeline = document.getElementById('cdnplayer_control_timeline');
    let base = 'rgb(23, 35, 34)';
    let hover = 'rgb(0, 173, 239)';
    if (timeline) {
      const descendants = timeline.getElementsByTagName('pjsdiv');
      const firstChild = descendants[0];
      if (firstChild) {
        base = getComputedStyle(firstChild).backgroundColor || base;
      }
      const hoverElement = descendants[4];
      if (hoverElement) {
        hover = getComputedStyle(hoverElement).backgroundColor || hover;
      }
    }
    return { base, hover };
  }

  function areControlsVisible(timelineElement, playInfo) {
    if (!timelineElement || !playInfo) return false;
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return false;
    const timelineStyles = getComputedStyle(timelineElement);
    const playStyles = getComputedStyle(playInfo.element);
    const playParentStyles = playInfo.element.parentElement ? getComputedStyle(playInfo.element.parentElement) : null;

    if (
      playStyles.display === 'none' ||
      playStyles.visibility === 'hidden' ||
      parseFloat(playStyles.opacity || '1') === 0 ||
      (playParentStyles && parseFloat(playParentStyles.opacity || '1') === 0)
    ) {
      return false;
    }

    const styles = timelineStyles;
    if (styles.display === 'none') return false;
    const opacity = parseFloat(styles.opacity || '1');
    return opacity > 0.05;
  }

  function setButtonSize(width, height, targetButton = nextButton) {
    const button = targetButton || nextButton;
    if (!button) return { width: 0, height: 0 };
    const minWidth = button.dataset.minWidth ? parseInt(button.dataset.minWidth, 10) : 24;
    const minHeight = button.dataset.minHeight ? parseInt(button.dataset.minHeight, 10) : 24;
    const clampedWidth = Math.max(minWidth || 24, Math.min(120, Math.round(width || 32)));
    const clampedHeight = Math.max(minHeight || 24, Math.min(120, Math.round(height || clampedWidth)));
    button.style.width = `${ clampedWidth }px`;
    button.style.height = `${ clampedHeight }px`;
    button.style.lineHeight = `${ clampedHeight }px`;
    return { width: clampedWidth, height: clampedHeight };
  }

  function adjustBorderRadius(radius, deltaPx) {
    if (!radius || radius === '0px') return null;
    const adjustSegment = (segment) =>
      segment
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => {
          const numeric = parseFloat(value);
          if (Number.isNaN(numeric)) {
            return value;
          }
          return `${ Math.max(0, numeric + deltaPx) }px`;
        })
        .join(' ');

    if (radius.includes('/')) {
      const [first, second] = radius.split('/');
      return `${ adjustSegment(first) } / ${ adjustSegment(second || first) }`;
    }
    return adjustSegment(radius);
  }

  function setButtonColors(targetButton, baseColor, hoverColor) {
    const button = targetButton || nextButton;
    if (!button) return;
    const normal = baseColor || 'rgb(23, 35, 34)';
    const hover = hoverColor || 'rgba(29, 174, 236, 0.7)';
    button.dataset.nextButtonBaseColor = normal;
    button.dataset.nextButtonHoverColor = hover;
    updateButtonBackground(button);
    ensureHoverHandlers(button);
  }

  function ensureHoverHandlers(targetButton = nextButton) {
    const button = targetButton || nextButton;
    if (!button || button.dataset.hoverHandlerAttached === 'true') {
      return;
    }
    button.addEventListener('mouseenter', () => {
      if (button.classList.contains('is-disabled')) return;
      button.dataset.isHovered = 'true';
      updateButtonBackground(button);
    });
    button.addEventListener('mouseleave', () => {
      button.dataset.isHovered = 'false';
      updateButtonBackground(button);
    });
    button.dataset.hoverHandlerAttached = 'true';
  }

  function updateButtonBackground(targetButton = nextButton) {
    const button = targetButton || nextButton;
    if (!button) return;
    const hovered = button.dataset.isHovered === 'true';
    const baseColor = button.dataset.nextButtonBaseColor;
    const hoverColor = button.dataset.nextButtonHoverColor;
    const targetColor = hovered ? (hoverColor || baseColor) : baseColor;
    if (targetColor) {
      button.style.backgroundColor = targetColor;
    }
  }

  function getPreferredAnchor(timelineElement) {
    const volumeContainer = getVolumeContainer();
    if (volumeContainer && isElementVisible(volumeContainer)) {
      return { element: volumeContainer, placeBefore: true };
    }

    const gearContainer = getGearContainer();
    if (gearContainer && isElementVisible(gearContainer)) {
      return { element: gearContainer, placeBefore: true };
    }

    return { element: timelineElement, placeBefore: false };
  }

  function isElementVisible(element) {
    if (!element) return false;
    const styles = getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden' || parseFloat(styles.opacity || '1') === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function positionEpisodeButtons() {
    if (!nextButton || !prevButton) return;
    syncCastIntegration();
    ensureAttached();
    applyZoomToVideoElement();
    updatePlayButtonTooltip();

    const playerElement = document.getElementById('oframecdnplayer');
    const timelineElement = document.getElementById('cdnplayer_control_timeline');
    if (!playerElement || !timelineElement) {
      getControlledButtons().forEach((button) => {
        if (button) button.style.display = 'none';
      });
      return;
    }

    const playerRect = playerElement.getBoundingClientRect();
    const playInfo = getPlayControlInfo();
    if (playInfo) {
      attachPlayButtonHover(playInfo.element);
    }
    const controlsVisible = areControlsVisible(timelineElement, playInfo);
    if (!controlsVisible) {
      getControlledButtons().forEach((button) => {
        if (button) button.style.display = 'none';
      });
      return;
    }

    if (playInfo) {
      getControlledButtons().forEach((button) => applyButtonStyles(playInfo, button));
      const sizeMap = new Map();
      getControlledButtons().forEach((button) => {
        sizeMap.set(button, setButtonSize(playInfo.rect.width, playInfo.rect.height, button));
      });
      const nextSize = sizeMap.get(nextButton);
      const prevSize = sizeMap.get(prevButton);
      const nextLeft = playInfo.rect.left - playerRect.left - 2;
      const top = playInfo.rect.top - playerRect.top - nextSize.height - BUTTON_MARGIN_PX + 3;
      const prevLeft = nextLeft - prevSize.width - BUTTON_MARGIN_PX;

      const sharedTop = `${ Math.max(0, top) }px`;
      const nextDisplayLeft = Math.max(BUTTON_MARGIN_PX, nextLeft) + 71;
      const prevDisplayLeft = Math.max(BUTTON_MARGIN_PX, prevLeft) - 2;

      nextButton.style.left = `${ nextDisplayLeft }px`;
      nextButton.style.top = sharedTop;
      prevButton.style.left = `${ prevDisplayLeft }px`;
      prevButton.style.top = sharedTop;

      let currentLeft = nextDisplayLeft + nextSize.width + BUTTON_MARGIN_PX;
      [zoomOutButton, zoomResetButton, zoomInButton, castToggleButton].forEach((button) => {
        if (!button) return;
        const buttonSize = sizeMap.get(button);
        button.style.left = `${ currentLeft }px`;
        button.style.top = sharedTop;
        currentLeft += (buttonSize ? buttonSize.width : nextSize.width) + BUTTON_MARGIN_PX;
      });

      getControlledButtons().forEach((button) => {
        if (button) button.style.display = 'block';
      });
      return;
    }

    detachPlayButtonHover();
    getControlledButtons().forEach((button) => applyButtonStyles(null, button));
    const fallbackDimension = (nextButton.offsetWidth || parseFloat(nextButton.style.width)) || 32;
    const sizeMap = new Map();
    getControlledButtons().forEach((button) => {
      sizeMap.set(button, setButtonSize(fallbackDimension, fallbackDimension, button));
    });
    const { width: fallbackWidth, height: fallbackHeight } = sizeMap.get(nextButton);
    reserveTimelineSpace();

    const { element: anchorElement, placeBefore } = getPreferredAnchor(timelineElement);
    const anchorNode = anchorElement || timelineElement;
    const anchorRect = anchorNode.getBoundingClientRect();

    const nextLeft = placeBefore
      ? anchorRect.left - playerRect.left - fallbackWidth - BUTTON_MARGIN_PX
      : anchorRect.right - playerRect.left + BUTTON_MARGIN_PX;
    const top = anchorRect.top - playerRect.top + (anchorRect.height - fallbackHeight) / 2;

    const prevLeft = nextLeft - fallbackWidth - BUTTON_MARGIN_PX;
    const sharedTop = `${ Math.max(0, top) }px`;
    const nextDisplayLeft = Math.max(BUTTON_MARGIN_PX, nextLeft);
    const prevDisplayLeft = Math.max(BUTTON_MARGIN_PX, prevLeft);

    nextButton.style.left = `${ nextDisplayLeft }px`;
    nextButton.style.top = sharedTop;
    prevButton.style.left = `${ prevDisplayLeft }px`;
    prevButton.style.top = sharedTop;

    let currentLeft = nextDisplayLeft + fallbackWidth + BUTTON_MARGIN_PX;
    [zoomOutButton, zoomResetButton, zoomInButton, castToggleButton].forEach((button) => {
      if (!button) return;
      const buttonSize = sizeMap.get(button);
      button.style.left = `${ currentLeft }px`;
      button.style.top = sharedTop;
      currentLeft += (buttonSize ? buttonSize.width : fallbackWidth) + BUTTON_MARGIN_PX;
    });

    getControlledButtons().forEach((button) => {
      if (button) button.style.display = 'block';
    });
  }

  function init() {
    injectCastHelper();
    createPrevButton();
    createNextButton();
    createZoomButtons();
    createCastToggleButton();
    updateEpisodeButtons();
    positionEpisodeButtons();
    setInterval(positionEpisodeButtons, LAYOUT_INTERVAL_MS);
    setInterval(pollCastState, 800);
    setInterval(maybeAutoAdvanceCast, 1000);
    window.addEventListener('resize', positionEpisodeButtons);
    document.addEventListener('fullscreenchange', positionEpisodeButtons);
  }

  init();
})();
