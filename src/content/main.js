/**
 * main.js (Content)
 * 组合各个模块，实现扩展的功能。
 */
(function () {
  'use strict';

  const { getConfig, resetConfig } = window.__TD_CONFIG__;
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
      },
      () => {
        if (!resetConfig) return null;
        config = resetConfig();
        engine.updateConfig(config);
        if (config.enabled) {
          container.style.display = '';
        } else {
          container.style.display = 'none';
        }
        engine.clear();
        return config;
      }
    );
    
    ui.mount(player);

    console.log('[Twitch Danmaku] Mounted to player.');
    return true;
  }

  // Third-party emote scanner and cache state
  let chatObserver = null;
  let scannerInterval = null;

  /**
   * Scan a chat message DOM element for third-party and Twitch emotes.
   * Extracts the code, URL, and aspect ratio and stores it in window.__TD_EMOTE_CACHE__.
   * @param {HTMLElement} lineEl
   */
  function scanLineForEmotes(lineEl) {
    const imgs = lineEl.querySelectorAll('img');
    imgs.forEach(img => {
      const code = img.getAttribute('alt') || img.alt || img.getAttribute('data-emote-name');
      if (!code) return;

      const src = img.src;
      if (!src) return;

      // Filter out user badges (badges are usually in user containers or have /badges/ in src)
      const isBadge = img.classList.contains('chat-badge') || 
                      img.closest('.chat-line__username-container') || 
                      src.includes('/badges/') ||
                      (img.hasAttribute('data-a-target') && img.getAttribute('data-a-target').includes('badge'));

      if (isBadge) return;

      // Identify third-party or Twitch emotes based on URL patterns or classes
      const isTwitch = src.includes('static-cdn.jtvnw.net/emoticons');
      const is7TV = src.includes('cdn.7tv.app') || img.classList.contains('seventv-emote');
      const isBTTV = src.includes('cdn.betterttv.net') || img.classList.contains('bttv-emote');
      const isFFZ = src.includes('cdn.frankerfacez.com') || img.classList.contains('ffz-emote');
      const isEmote = img.classList.contains('emoticon') || 
                      img.classList.contains('danmaku-emote') || 
                      src.includes('emote') || 
                      src.includes('emoji') ||
                      isTwitch || is7TV || isBTTV || isFFZ;

      if (!isEmote) return;

      if (!window.__TD_EMOTE_CACHE__) {
        window.__TD_EMOTE_CACHE__ = {};
      }

      // Calculate the image's aspect ratio (width / height)
      let ratio = 1;
      if (img.naturalWidth && img.naturalHeight) {
        ratio = img.naturalWidth / img.naturalHeight;
      } else if (img.width && img.height) {
        ratio = img.width / img.height;
      }

      const existing = window.__TD_EMOTE_CACHE__[code];
      // Only cache if new or if updating a placeholder ratio (1) with a real one
      if (!existing || (existing.ratio === 1 && ratio !== 1)) {
        window.__TD_EMOTE_CACHE__[code] = { src, ratio };
      }

      // If the image hasn't loaded natural dimensions yet, listen for the load event
      if (ratio === 1 && (!img.naturalWidth || !img.naturalHeight)) {
        img.addEventListener('load', () => {
          if (img.naturalWidth && img.naturalHeight) {
            const newRatio = img.naturalWidth / img.naturalHeight;
            if (window.__TD_EMOTE_CACHE__[code]) {
              window.__TD_EMOTE_CACHE__[code].ratio = newRatio;
            }
          }
        }, { once: true });
      }
    });
  }

  /**
   * Start scanning the Twitch chat container for emotes dynamically.
   */
  function initEmoteScanner() {
    cleanupEmoteScanner();

    const chatContainerSelector = '.chat-scrollable-area__message-container, .chat-scrollable-area__content, .chat-list--default, .chat-list--other';
    
    // Periodically poll for the chat container since it loads dynamically
    scannerInterval = setInterval(() => {
      const chatContainer = document.querySelector(chatContainerSelector);
      if (!chatContainer) return;
      
      clearInterval(scannerInterval);
      scannerInterval = null;
      console.log('[Twitch Danmaku] Chat container found, initializing emote scanner.');

      // Pre-scan existing message lines in the chat
      const existingLines = chatContainer.querySelectorAll('.chat-line__message');
      existingLines.forEach(line => {
        try { scanLineForEmotes(line); } catch (e) {}
      });

      // Observe future message insertions
      chatObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('chat-line__message')) {
                try { scanLineForEmotes(node); } catch (e) {}
              } else {
                const lines = node.querySelectorAll('.chat-line__message');
                lines.forEach(line => {
                  try { scanLineForEmotes(line); } catch (e) {}
                });
              }
            }
          }
        }
      });

      chatObserver.observe(chatContainer, { childList: true, subtree: true });
    }, 2000);
  }

  /**
   * Clean up scanner timers and observers.
   */
  function cleanupEmoteScanner() {
    if (scannerInterval) {
      clearInterval(scannerInterval);
      scannerInterval = null;
    }
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
    }
  }

  function tryMount() {
    if (mount()) {
      initEmoteScanner();
      return true;
    }
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
      cleanupEmoteScanner();
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
