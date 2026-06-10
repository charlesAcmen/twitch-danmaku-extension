/**
 * main.js (Content)
 * 组合各个模块，实现扩展的功能。
 */
(function () {
  'use strict';

  const { getConfig } = window.__TD_CONFIG__;
  const { DanmakuEngine } = window.__TD_ENGINE__;
  const { DanmakuUI } = window.__TD_UI__;
  const { findPlayer } = window.__TD_PLAYER__;

  let config = getConfig();
  let engine = null;
  let ui = null;
  let playerEl = null;
  let container = null;
  let mountRetryCount = 0;
  const MAX_MOUNT_RETRIES = 60;

  function mount() {
    const player = findPlayer();
    if (!player) return false;

    if (playerEl === player && container && container.parentElement === player) {
      return true;
    }

    playerEl = player;
    const pos = window.getComputedStyle(player).position;
    if (pos === 'static') {
      player.style.position = 'relative';
    }

    // Create container
    container = document.createElement('div');
    container.className = 'danmaku-container';
    container.id = 'twitch-danmaku-overlay';
    
    player.appendChild(container);

    // Initialize engine and UI
    engine = new DanmakuEngine(container, config);
    ui = new DanmakuUI(
      config, 
      (changes) => {
        config = { ...config, ...changes };
        if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
          window.__TD_CONFIG__.saveConfig(config);
        }
        engine.updateConfig(config);
      },
      (enabled) => {
        config.enabled = enabled;
        if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
          window.__TD_CONFIG__.saveConfig(config);
        }
        engine.updateConfig({ enabled });
        if (enabled) {
          container.style.display = '';
        } else {
          container.style.display = 'none';
          engine.clear();
        }
      }
    );
    
    ui.mount(player);

    console.log('[Twitch Danmaku] Mounted to player.');
    return true;
  }

  function tryMount() {
    if (mount()) return true;
    mountRetryCount++;
    if (mountRetryCount < MAX_MOUNT_RETRIES) {
      setTimeout(tryMount, 500);
    }
    return false;
  }

  window.addEventListener('__twitch_danmaku_msg__', function (event) {
    const data = event.detail;
    if (!data || !data.message || !engine) return;

    if (!container || !container.parentElement) {
      if (!mount()) return;
    }

    engine.add(data.username, data.message, data.color, data.emotes, data.role);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryMount);
  } else {
    tryMount();
  }

  // Handle SPA navigation
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      mountRetryCount = 0;
      if (container) container.remove();
      if (ui && ui.toggleBtn) ui.toggleBtn.remove();
      if (ui && ui.settingsPanel) ui.settingsPanel.remove();
      container = null;
      playerEl = null;
      setTimeout(tryMount, 1000);
    }
  });
  urlObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  console.log('[Twitch Danmaku] Content main ready.');
})();
