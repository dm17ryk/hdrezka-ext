(function() {
  if (window.hdrezkaCastBridgeLoaded) return;
  window.hdrezkaCastBridgeLoaded = true;

  function getPlayerInstance() {
    return window.pljssglobal && window.pljssglobal[0];
  }

  function recast() {
    const inst = getPlayerInstance();
    if (!inst) return false;
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
    }
    if (data.reply) {
      window.postMessage(
        { type: 'hdrezka_cast_control_ack', action: data.action, ok },
        '*'
      );
    }
  });
})();
