// content.js

(function() {
  console.log('Content script reloaded');
  //debugger;

  let nextButton;
  let prevButton;
  let zoomOutButton;
  let zoomResetButton;
  let zoomInButton;
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
  let observedPlayButton = null;
  let playButtonHoverHandlers = null;
  let activeZoomStorageKey = null;
  const CAST_LABEL_START = 'Start Cast';
  const CAST_LABEL_STOP = 'Stop Cast';
  const CAST_MIN_WIDTH = 86;
  const CAST_ICON_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M1,18 L1,21 L4,21 C4,19.3 2.66,18 1,18 Z"></path>
      <path d="M1,14 L1,16 C3.76,16 6,18.2 6,21 L8,21 C8,17.13 4.87,14 1,14 Z"></path>
      <path d="M1,10 L1,12 C5.97,12 10,16.0 10,21 L12,21 C12,14.92 7.07,10 1,10 Z"></path>
      <path d="M21,3 L3,3 C1.9,3 1,3.9 1,5 L1,8 L3,8 L3,5 L21,5 L21,19 L14,19 L14,21 L21,21 C22.1,21 23,20.1 23,19 L23,5 C23,3.9 22.1,3 21,3 Z"></path>
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
    updatePlayButtonTooltip();
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

  function updatePlayButtonTooltip() {
    const playElement = getPlayButtonElement();
    if (!playElement) return;
    const info = getActiveEpisodeInfo();
    const label = formatEpisodeLabel(info);
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
      prevEpisode.click();
      setTimeout(updateEpisodeButtons, 2000);
      setTimeout(startEpisodePlayback, 2000);
    }
  }

  function navigateToNextEpisode() {
    const nextEpisode = getNextEpisodeElement();
    if (nextEpisode) {
      nextEpisode.click();
      setTimeout(updateEpisodeButtons, 2000);
      setTimeout(startEpisodePlayback, 2000);
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

  function getPlayerApi() {
    if (!window.pljssglobal || !Array.isArray(window.pljssglobal) || window.pljssglobal.length === 0) {
      return null;
    }
    const instance = window.pljssglobal[0];
    return instance && typeof instance.api === 'function' ? instance.api : null;
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

  function isCastSessionActive() {
    if (!window.cast || !cast.framework || !cast.framework.SessionState) return false;
    const state = getCastSessionState();
    return (
      state === cast.framework.SessionState.SESSION_STARTED ||
      state === cast.framework.SessionState.SESSION_RESUMED ||
      state === cast.framework.SessionState.SESSION_STARTING
    );
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
    const nativeButton = findNativeCastButton();
    if (nativeButton) {
      nativeButton.click();
      return;
    }
    const context = getCastContext();
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
    }
    updateCastButtonState();
  }

  function handleCastStateChange() {
    updateCastButtonState();
  }

  function attachCastSessionListener() {
    const context = getCastContext();
    if (!context || castSessionListenerAttached) return;
    if (!window.cast || !cast.framework || !cast.framework.CastContextEventType) return;
    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, handleCastStateChange);
    castSessionListenerAttached = true;
  }

  function syncCastIntegration() {
    ensureCastInitialized();
    attachCastSessionListener();
    updateCastButtonState();
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
    createPrevButton();
    createNextButton();
    createZoomButtons();
    createCastToggleButton();
    updateEpisodeButtons();
    positionEpisodeButtons();
    setInterval(positionEpisodeButtons, LAYOUT_INTERVAL_MS);
    window.addEventListener('resize', positionEpisodeButtons);
    document.addEventListener('fullscreenchange', positionEpisodeButtons);
  }

  init();
})();
