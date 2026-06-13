/**
 * emote-scanner.js
 * Isolated module for scanning and caching third-party emotes from Twitch chat DOM.
 * 
 * This module passively observes the chat container using MutationObserver to extract
 * emote information (code, URL, aspect ratio) from already-rendered DOM elements.
 * 
 * Zero-Risk Third-Party Emote Support:
 * - No external API calls to third-party services (7TV, BTTV, FFZ)
 * - No authentication tokens or private Twitch API usage
 * - Pure client-side DOM scraping of publicly visible elements
 * - 100% ban-safe approach
 * 
 * 第三方表情扫描器
 * 独立模块，负责从 Twitch 聊天 DOM 中扫描和缓存第三方表情。
 * 
 * 采用被动观察模式，使用 MutationObserver 从已渲染的 DOM 元素中提取表情信息
 * （代码、URL、宽高比）。
 * 
 * 零风险第三方表情支持：
 * - 不调用任何第三方服务的外部 API（7TV、BTTV、FFZ）
 * - 不使用认证令牌或私有 Twitch API
 * - 纯客户端 DOM 抓取公开可见元素
 * - 100% 防封号方案
 */
(function (exports) {
  'use strict';

  let chatObserver = null;
  let scannerInterval = null;

  /**
   * Scan a chat message DOM element for third-party and Twitch emotes.
   * Extracts the code, URL, and aspect ratio and stores it in window.__TD_EMOTE_CACHE__.
   * 
   * 扫描聊天消息 DOM 元素以查找第三方和 Twitch 表情。
   * 提取代码、URL 和宽高比，并存储到 window.__TD_EMOTE_CACHE__。
   * 
   * @param {HTMLElement} lineEl - The chat line element to scan / 要扫描的聊天行元素
   */
  function scanLineForEmotes(lineEl) {
    const imgs = lineEl.querySelectorAll('img');
    imgs.forEach(img => {
      const code = img.getAttribute('alt') || img.alt || img.getAttribute('data-emote-name');
      if (!code) return;

      const src = img.src;
      if (!src) return;

      // Filter out user badges (badges are usually in user containers or have /badges/ in src)
      // 过滤掉用户徽章（徽章通常在用户容器中或 src 包含 /badges/）
      const isBadge = img.classList.contains('chat-badge') || 
                      img.closest('.chat-line__username-container') || 
                      src.includes('/badges/') ||
                      (img.hasAttribute('data-a-target') && img.getAttribute('data-a-target').includes('badge'));

      if (isBadge) return;

      // Identify third-party or Twitch emotes based on URL patterns or classes
      // 根据 URL 模式或类名识别第三方或 Twitch 表情
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
      // 计算图像的宽高比（宽度 / 高度）
      let ratio = 1;
      if (img.naturalWidth && img.naturalHeight) {
        ratio = img.naturalWidth / img.naturalHeight;
      } else if (img.width && img.height) {
        ratio = img.width / img.height;
      }

      const existing = window.__TD_EMOTE_CACHE__[code];
      // Only cache if new or if updating a placeholder ratio (1) with a real one
      // 仅在新表情或用真实比例更新占位比例 (1) 时缓存
      if (!existing || (existing.ratio === 1 && ratio !== 1)) {
        window.__TD_EMOTE_CACHE__[code] = { src, ratio };
      }

      // If the image hasn't loaded natural dimensions yet, listen for the load event
      // 如果图像尚未加载自然尺寸，则监听 load 事件
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
   * Polls for the chat container and sets up a MutationObserver once found.
   * 
   * 动态开始扫描 Twitch 聊天容器以查找表情。
   * 轮询聊天容器，找到后设置 MutationObserver。
   */
  function initEmoteScanner() {
    cleanupEmoteScanner();

    const chatContainerSelector = '.chat-scrollable-area__message-container, .chat-scrollable-area__content, .chat-list--default, .chat-list--other';
    
    // Periodically poll for the chat container since it loads dynamically
    // 定期轮询聊天容器，因为它是动态加载的
    scannerInterval = setInterval(() => {
      const chatContainer = document.querySelector(chatContainerSelector);
      if (!chatContainer) return;
      
      clearInterval(scannerInterval);
      scannerInterval = null;
      console.log('[Twitch Danmaku] Chat container found, initializing emote scanner.');

      // Pre-scan existing message lines in the chat
      // 预扫描聊天中现有的消息行
      const existingLines = chatContainer.querySelectorAll('.chat-line__message');
      existingLines.forEach(line => {
        try { scanLineForEmotes(line); } catch (e) {
          console.warn('[Twitch Danmaku] Error scanning existing line:', e);
        }
      });

      // Observe future message insertions
      // 观察未来的消息插入
      chatObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && node.classList.contains('chat-line__message')) {
                try { scanLineForEmotes(node); } catch (e) {
                  console.warn('[Twitch Danmaku] Error scanning new line:', e);
                }
              } else if (node.querySelectorAll) {
                const lines = node.querySelectorAll('.chat-line__message');
                lines.forEach(line => {
                  try { scanLineForEmotes(line); } catch (e) {
                    console.warn('[Twitch Danmaku] Error scanning descendant line:', e);
                  }
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
   * Call this when navigating away or unmounting.
   * 
   * 清理扫描器计时器和观察者。
   * 在导航离开或卸载时调用此方法。
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

  // Export public API
  // 导出公共 API
  exports.initEmoteScanner = initEmoteScanner;
  exports.cleanupEmoteScanner = cleanupEmoteScanner;

})(window.__TD_EMOTE_SCANNER__ = window.__TD_EMOTE_SCANNER__ || {});
