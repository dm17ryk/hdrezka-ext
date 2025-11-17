// content.js

(function() {
  console.log('Content script reloaded');
  //debugger;

  let nextButton;
  let prevButton;
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
  let observedPlayButton = null;
  let playButtonHoverHandlers = null;

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
      timeline.style.setProperty('padding-right', `${ TIMELINE_PADDING_PX }px`, 'important');
    }
  }

  function ensureAttached() {
    const playerElement = document.getElementById('oframecdnplayer');
    if (!playerElement) return;
    [prevButton, nextButton].forEach((button) => {
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
          [prevButton, nextButton].forEach((button) => {
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
          [prevButton, nextButton].forEach((button) => {
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
    const clampedWidth = Math.max(24, Math.min(120, Math.round(width || 32)));
    const clampedHeight = Math.max(24, Math.min(120, Math.round(height || clampedWidth)));
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
    ensureAttached();

    const playerElement = document.getElementById('oframecdnplayer');
    const timelineElement = document.getElementById('cdnplayer_control_timeline');
    if (!playerElement || !timelineElement) {
      [prevButton, nextButton].forEach((button) => {
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
      [prevButton, nextButton].forEach((button) => {
        if (button) button.style.display = 'none';
      });
      return;
    }

    if (playInfo) {
      [prevButton, nextButton].forEach((button) => applyButtonStyles(playInfo, button));
      const nextSize = setButtonSize(playInfo.rect.width, playInfo.rect.height, nextButton);
      const prevSize = setButtonSize(playInfo.rect.width, playInfo.rect.height, prevButton);
      const nextLeft = playInfo.rect.left - playerRect.left - 2;
      const top = playInfo.rect.top - playerRect.top - nextSize.height - BUTTON_MARGIN_PX + 3;
      const prevLeft = nextLeft - prevSize.width - BUTTON_MARGIN_PX;

      nextButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, nextLeft) + 71 }px`;
      nextButton.style.top = `${ Math.max(0, top) }px`;
      prevButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, prevLeft) - 2 }px`;
      prevButton.style.top = `${ Math.max(0, top) }px`;
      nextButton.style.display = 'block';
      prevButton.style.display = 'block';
      return;
    }

    detachPlayButtonHover();
    [prevButton, nextButton].forEach((button) => applyButtonStyles(null, button));
    const fallbackDimension = (nextButton.offsetWidth || parseFloat(nextButton.style.width)) || 32;
    const { width: fallbackWidth, height: fallbackHeight } =
      setButtonSize(fallbackDimension, fallbackDimension, nextButton);
    setButtonSize(fallbackDimension, fallbackDimension, prevButton);
    reserveTimelineSpace();

    const { element: anchorElement, placeBefore } = getPreferredAnchor(timelineElement);
    const anchorNode = anchorElement || timelineElement;
    const anchorRect = anchorNode.getBoundingClientRect();

    const nextLeft = placeBefore
      ? anchorRect.left - playerRect.left - fallbackWidth - BUTTON_MARGIN_PX
      : anchorRect.right - playerRect.left + BUTTON_MARGIN_PX;
    const top = anchorRect.top - playerRect.top + (anchorRect.height - fallbackHeight) / 2;

    const prevLeft = nextLeft - fallbackWidth - BUTTON_MARGIN_PX;

    nextButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, nextLeft) }px`;
    nextButton.style.top = `${ Math.max(0, top) }px`;
    prevButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, prevLeft) }px`;
    prevButton.style.top = `${ Math.max(0, top) }px`;
    nextButton.style.display = 'block';
    prevButton.style.display = 'block';
  }

  function init() {
    createPrevButton();
    createNextButton();
    updateEpisodeButtons();
    positionEpisodeButtons();
    setInterval(positionEpisodeButtons, LAYOUT_INTERVAL_MS);
    window.addEventListener('resize', positionEpisodeButtons);
    document.addEventListener('fullscreenchange', positionEpisodeButtons);
  }

  init();
})();
