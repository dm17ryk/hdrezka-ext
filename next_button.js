// content.js

(function() {
  console.log('Content script reloaded');
  //debugger;

  let nextButton;
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
              setTimeout(setNextButtonText, 2000);
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

  function setNextButtonText() {
    const nextEpisode = getNextEpisodeElement();
    if (nextButton) {
      const tooltip = getNextButtonTooltip(nextEpisode);
      nextButton.title = tooltip;
      nextButton.setAttribute('aria-label', tooltip);
      nextButton.classList.toggle('is-disabled', !nextEpisode);
      if (!nextEpisode) {
        nextButton.dataset.isHovered = 'false';
      }
      updateButtonBackground();
    }
    attachObserverToActive();
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

  function navigateToNextEpisode() {
    const nextEpisode = getNextEpisodeElement();
    if (nextEpisode) {
      nextEpisode.click();
      setTimeout(setNextButtonText, 2000);
      setTimeout(startNextEpisode, 2000);
    }
  }

  function startNextEpisode() {
    const player = document.getElementById('oframecdnplayer');
    if (!player) return;
    const descendants = player.childNodes;
    const startButton = descendants[7] && descendants[7].firstChild && descendants[7].firstChild.firstChild;
    if (startButton) {
      startButton.click();
    }
  }

  function createNextButton() {
    nextButton = document.createElement('pjsdiv');
    nextButton.id = 'next-episode-button';
    nextButton.innerHTML = NEXT_ICON_SVG;
    nextButton.title = 'Play next episode';
    nextButton.setAttribute('aria-label', 'Play next episode');
    nextButton.dataset.isHovered = 'false';
    nextButton.addEventListener('click', navigateToNextEpisode);
    setNextButtonText();

    const playerElement = document.getElementById('oframecdnplayer');
    if (playerElement) {
      playerElement.appendChild(nextButton);
    } else {
      document.body.appendChild(nextButton);
    }

    applyButtonStyles();
  }

  function applyButtonStyles(controlInfo) {
    if (!nextButton) return;
    const info = controlInfo === undefined ? getPlayControlInfo() : controlInfo;
    const timelineColors = getTimelineColors();
    const baseColor = timelineColors.base;
    const hoverColor = timelineColors.hover;

    if (info && info.styles) {
      const styles = info.styles;
      if (styles.borderRadius && styles.borderRadius !== '0px') {
        nextButton.style.borderRadius = styles.borderRadius;
      }
      if (styles.border && styles.border !== '0px none rgb(0, 0, 0)') {
        nextButton.style.border = styles.border;
      }
      if (styles.boxShadow && styles.boxShadow !== 'none') {
        nextButton.style.boxShadow = styles.boxShadow;
      }
      nextButton.style.color = info.iconColor || '#fff';
    } else {
      nextButton.style.borderRadius = '3px';
      nextButton.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      nextButton.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.4)';
      nextButton.style.color = '#fff';
    }

    setButtonColors(baseColor, hoverColor);
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
      timeline.style.setProperty('padding-right', `${ TIMELINE_PADDING_PX }px`, 'important');
    }
  }

  function ensureAttached() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (playerElement && nextButton && nextButton.parentElement !== playerElement) {
      playerElement.appendChild(nextButton);
    }
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

  function areControlsVisible(timelineElement) {
    if (!timelineElement) return false;
    const styles = getComputedStyle(timelineElement);
    if (styles.display === 'none') return false;
    const opacity = parseFloat(styles.opacity || '1');
    return opacity > 0.05;
  }

  function setButtonSize(size) {
    if (!nextButton) return 0;
    const clampedSize = Math.max(24, Math.min(48, Math.round(size)));
    nextButton.style.width = `${ clampedSize }px`;
    nextButton.style.height = `${ clampedSize }px`;
    nextButton.style.lineHeight = `${ clampedSize }px`;
    return clampedSize;
  }

  function setButtonColors(baseColor, hoverColor) {
    if (!nextButton) return;
    const normal = baseColor || 'rgb(23, 35, 34)';
    const hover = hoverColor || 'rgb(0, 173, 239)';
    nextButton.dataset.nextButtonBaseColor = normal;
    nextButton.dataset.nextButtonHoverColor = hover;
    updateButtonBackground();
    ensureHoverHandlers();
  }

  function ensureHoverHandlers() {
    if (!nextButton || nextButton.dataset.hoverHandlerAttached === 'true') {
      return;
    }
    nextButton.addEventListener('mouseenter', () => {
      if (nextButton.classList.contains('is-disabled')) return;
      nextButton.dataset.isHovered = 'true';
      updateButtonBackground();
    });
    nextButton.addEventListener('mouseleave', () => {
      nextButton.dataset.isHovered = 'false';
      updateButtonBackground();
    });
    nextButton.dataset.hoverHandlerAttached = 'true';
  }

  function updateButtonBackground() {
    if (!nextButton) return;
    const hovered = nextButton.dataset.isHovered === 'true';
    const baseColor = nextButton.dataset.nextButtonBaseColor;
    const hoverColor = nextButton.dataset.nextButtonHoverColor;
    const targetColor = hovered ? (hoverColor || baseColor) : baseColor;
    if (targetColor) {
      nextButton.style.backgroundColor = targetColor;
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

  function positionNextButton() {
    if (!nextButton) return;
    ensureAttached();

    const playerElement = document.getElementById('oframecdnplayer');
    const timelineElement = document.getElementById('cdnplayer_control_timeline');
    if (!playerElement || !timelineElement) {
      nextButton.style.display = 'none';
      return;
    }

    const controlsVisible = areControlsVisible(timelineElement);
    if (!controlsVisible) {
      nextButton.style.display = 'none';
      return;
    }

    const playerRect = playerElement.getBoundingClientRect();
    const playInfo = getPlayControlInfo();
    if (playInfo) {
      applyButtonStyles(playInfo);
      const actualSize = setButtonSize(Math.max(playInfo.rect.width, playInfo.rect.height));
      const left = playInfo.rect.left - playerRect.left;
      const top = playInfo.rect.top - playerRect.top - actualSize - BUTTON_MARGIN_PX;
      nextButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, left) }px`;
      nextButton.style.top = `${ Math.max(0, top) }px`;
      nextButton.style.display = 'block';
      return;
    }

    applyButtonStyles(null);
    const fallbackSize = setButtonSize((nextButton.offsetWidth || parseFloat(nextButton.style.width)) || 32);
    reserveTimelineSpace();

    const { element: anchorElement, placeBefore } = getPreferredAnchor(timelineElement);
    const anchorNode = anchorElement || timelineElement;
    const anchorRect = anchorNode.getBoundingClientRect();

    const left = placeBefore
      ? anchorRect.left - playerRect.left - fallbackSize - BUTTON_MARGIN_PX
      : anchorRect.right - playerRect.left + BUTTON_MARGIN_PX;
    const top = anchorRect.top - playerRect.top + (anchorRect.height - fallbackSize) / 2;

    nextButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, left) }px`;
    nextButton.style.top = `${ Math.max(0, top) }px`;
    nextButton.style.display = 'block';
  }

  function init() {
    createNextButton();
    positionNextButton();
    setInterval(positionNextButton, LAYOUT_INTERVAL_MS);
    window.addEventListener('resize', positionNextButton);
    document.addEventListener('fullscreenchange', positionNextButton);
  }

  init();
})();
