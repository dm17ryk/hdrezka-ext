// content.js

(function() {
  console.log('Content script reloaded');

  let nextButton;
  const observedEpisodes = new WeakSet();
  const LAYOUT_INTERVAL_MS = 800;
  const BUTTON_MARGIN_PX = 12;
  const TIMELINE_PADDING_PX = 110;

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
      nextButton.textContent = '>>';
      const tooltip = getNextButtonTooltip(nextEpisode);
      nextButton.title = tooltip;
      nextButton.setAttribute('aria-label', tooltip);
      nextButton.classList.toggle('is-disabled', !nextEpisode);
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
    nextButton.textContent = '>>';
    nextButton.title = 'Play next episode';
    nextButton.setAttribute('aria-label', 'Play next episode');
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

  function applyButtonStyles() {
    const timeline = document.getElementById('cdnplayer_control_timeline');
    if (!timeline) {
      setTimeout(applyButtonStyles, 500);
      return;
    }
    const descendants = timeline.getElementsByTagName('pjsdiv');
    const firstChild = descendants[0];
    let backgroundColor = 'rgb(23, 35, 34)';
    if (firstChild) {
      backgroundColor = getComputedStyle(firstChild).backgroundColor || backgroundColor;
    }
    nextButton.style.backgroundColor = backgroundColor;
    nextButton.style.color = '#fff';

    const hoverElement = descendants[4];
    if (hoverElement) {
      const hoverStyles = getComputedStyle(hoverElement);
      const hoverColor = hoverStyles.backgroundColor || 'rgb(0, 173, 239)';
      nextButton.addEventListener('mouseenter', () => {
        nextButton.style.backgroundColor = hoverColor;
      });
      nextButton.addEventListener('mouseleave', () => {
        nextButton.style.backgroundColor = backgroundColor;
      });
    }
  }

  function getGearContainer() {
    const settingsPanel = document.getElementById('cdnplayer_settings');
    if (!settingsPanel) return null;
    return settingsPanel.parentElement ? settingsPanel.parentElement.previousElementSibling : null;
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

  function positionNextButton() {
    if (!nextButton) return;
    ensureAttached();

    const playerElement = document.getElementById('oframecdnplayer');
    const timelineElement = document.getElementById('cdnplayer_control_timeline');
    if (!playerElement || !timelineElement) return;

    reserveTimelineSpace();

    const playerRect = playerElement.getBoundingClientRect();
    const timelineRect = timelineElement.getBoundingClientRect();
    const buttonWidth = nextButton.offsetWidth || 24;
    const buttonHeight = nextButton.offsetHeight || 24;

    let anchorRect = timelineRect;
    const gearContainer = getGearContainer();
    if (gearContainer && getComputedStyle(gearContainer).display !== 'none') {
      const gearRect = gearContainer.getBoundingClientRect();
      if (gearRect.width > 0 && gearRect.height > 0) {
        anchorRect = gearRect;
      }
    }

    let left;
    if (anchorRect === timelineRect) {
      left = timelineRect.right - playerRect.left + BUTTON_MARGIN_PX;
    } else {
      left = anchorRect.left - playerRect.left - buttonWidth - BUTTON_MARGIN_PX;
    }
    const top = anchorRect.top - playerRect.top + (anchorRect.height - buttonHeight) / 2;

    nextButton.style.left = `${ Math.max(BUTTON_MARGIN_PX, left) }px`;
    nextButton.style.top = `${ Math.max(0, top) }px`;
    nextButton.style.display = 'block';
  }

  function init() {
    createNextButton();
    positionNextButton();
    setInterval(positionNextButton, LAYOUT_INTERVAL_MS);
    window.addEventListener('resize', positionNextButton);
  }

  init();
})();
