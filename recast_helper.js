(function() {
  if (window.hdrezkaCastBridgeLoaded) return;
  window.hdrezkaCastBridgeLoaded = true;

  function getPlayerInstance() {
    return window.pljssglobal && window.pljssglobal[0];
  }

  function recast() {
    const inst = getPlayerInstance();
    if (!inst) return false;
    try {
      if (inst.api) {
        inst.api('castinit');
      }
    } catch (error) {
      // ignore
    }
    if (inst.chromecast && typeof inst.chromecast.Go === 'function') {
      try {
        inst.chromecast.Go();
        return true;
      } catch (error) {
        // ignore
      }
    }
    if (inst.api) {
      try {
        inst.api('play');
        return true;
      } catch (error) {
        // ignore
      }
    }
    return false;
  }

  function seekPercent(percent) {
    const inst = getPlayerInstance();
    if (!inst || !inst.api) return false;
    const clamped = Math.max(0, Math.min(100, Number(percent)));
    if (!Number.isFinite(clamped)) return false;
    try {
      inst.api('seek', `${ clamped }%`);
      inst.api('play');
      return true;
    } catch (error) {
      return false;
    }
  }

  function inferContentType(url) {
    if (!url || typeof url !== 'string') return 'video/mp4';
    if (url.includes('.m3u8')) return 'application/x-mpegURL';
    if (url.includes('.mpd')) return 'application/dash+xml';
    if (url.match(/\\.mp4($|\\?)/i)) return 'video/mp4';
    return 'video/mp4';
  }

  function loadCurrentToCast(overrideUrl, candidates) {
    if (!window.cast || !cast.framework || !chrome || !chrome.cast || !chrome.cast.media) {
      console.log('[hdrezka][cast]', 'loadCurrent missing cast framework');
      return false;
    }
    const ctx = cast.framework.CastContext.getInstance();
    const session = ctx && ctx.getCurrentSession ? ctx.getCurrentSession() : null;
    if (!session) {
      console.log('[hdrezka][cast]', 'loadCurrent no session');
      return false;
    }
    const inst = getPlayerInstance();
    if (!inst || !inst.api) {
      console.log('[hdrezka][cast]', 'loadCurrent no player api');
      return false;
    }
    let file = null;
    const localCandidates = [];
    const addCandidate = (url, source, ts) => {
      if (url && typeof url === 'string') {
        localCandidates.push({ url, source, ts: typeof ts === 'number' ? ts : Date.now() });
      }
    };
    if (Array.isArray(candidates)) {
      candidates.forEach((c) => addCandidate(c.url, c.source || 'cs:candidate', c.ts));
    }
    if (overrideUrl) {
      addCandidate(overrideUrl, 'override', Date.now());
    } else {
      try {
        const apiFile = inst.api('file');
        if (apiFile) addCandidate(apiFile, 'api:file');
      } catch (error) {
        // ignore
      }
    }
    const pickBest = () => {
      if (overrideUrl && typeof overrideUrl === 'string' && overrideUrl.startsWith('http')) {
        return { url: overrideUrl, source: 'override', ts: Date.now() };
      }
      const httpCandidates = localCandidates.filter((c) => c.url && c.url.startsWith('http') && !c.url.startsWith('blob:'));
      if (httpCandidates.length > 0) {
        httpCandidates.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return httpCandidates[0];
      }
      const any = localCandidates[0] || null;
      return any;
    };

    if (inst && inst.media && inst.media.file) addCandidate(inst.media.file, 'media:file');
    if (inst && inst.media && Array.isArray(inst.media.files)) {
      for (const f of inst.media.files) {
        addCandidate(f && f.file ? f.file : f, 'media:files');
      }
    }
    if (inst && inst.playlist && Array.isArray(inst.playlist)) {
      for (const entry of inst.playlist) {
        if (!entry) continue;
        addCandidate(entry.file, 'playlist:file');
        addCandidate(entry.url, 'playlist:url');
        addCandidate(entry.src, 'playlist:src');
        if (entry.sources && Array.isArray(entry.sources)) {
          entry.sources.forEach((s) => addCandidate(s && (s.file || s.url || s), 'playlist:sources'));
        }
      }
    }

    const chosen = pickBest();
    const url = chosen ? chosen.url : null;

    console.log('[hdrezka][cast]', 'loadCurrent candidates', localCandidates, 'chosen', url, chosen);

    if (!url) {
      console.log('[hdrezka][cast]', 'loadCurrent no url', { candidates: localCandidates });
      return false;
    }
    const mediaInfo = new chrome.cast.media.MediaInfo(url, inferContentType(url));
    mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = 0;
    try {
      const result = session.loadMedia(request);
      Promise.resolve(result)
        .then(() => console.log('[hdrezka][cast]', 'loadCurrent sent', { url }))
        .catch((error) => console.log('[hdrezka][cast]', 'loadCurrent load rejected', error));
      return true;
    } catch (error) {
      console.log('[hdrezka][cast]', 'loadCurrent failed', error, { candidates: localCandidates });
      return false;
    }
  }

  function stopCast() {
    const inst = getPlayerInstance();
    let ok = false;
    if (inst && inst.chromecast && typeof inst.chromecast.Stop === 'function') {
      try {
        inst.chromecast.Stop();
        ok = true;
      } catch (error) {
        // ignore
      }
    }
    if (!ok && window.cast && cast.framework) {
      const ctx = cast.framework.CastContext.getInstance();
      const session = ctx && ctx.getCurrentSession ? ctx.getCurrentSession() : null;
      const media = session && session.getMediaSession ? session.getMediaSession() : null;
      if (media && typeof media.stop === 'function') {
        try {
          media.stop();
          ok = true;
        } catch (error) {
          // ignore
        }
      }
    }
    return ok;
  }

  function dumpMedia() {
    const inst = getPlayerInstance();
    if (!inst) return null;
    let apiPlaylist = null;
    try {
      apiPlaylist = inst.api ? inst.api('playlist') : null;
    } catch (error) {
      // ignore
    }
    let apiFile = null;
    try {
      apiFile = inst.api ? inst.api('file') : null;
    } catch (error) {
      // ignore
    }
    return {
      media: inst.media || null,
      playlist: inst.playlist || null,
      apiPlaylist,
      apiFile
    };
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'hdrezka_cast_control') return;

    let ok = false;
    if (data.action === 'recast') {
      ok = recast();
    } else if (data.action === 'seekPercent') {
      ok = seekPercent(data.percent);
    } else if (data.action === 'loadCurrent') {
      ok = loadCurrentToCast(data.url, data.candidates);
    } else if (data.action === 'stopCast') {
      ok = stopCast();
    } else if (data.action === 'dumpMedia') {
      ok = dumpMedia();
    }
    if (data.reply) {
      window.postMessage(
        { type: 'hdrezka_cast_control_ack', action: data.action, ok },
        '*'
      );
    }
  });
})();
