/**
 * twitch-player.js
 * 负责寻找 Twitch 播放器容器，以及处理 URL 切换等。
 */
(function (exports) {
  'use strict';

  function findPlayer() {
    const selectors = [
      '.video-player__container',
      '.video-player',
      '[data-a-target="video-player"]',
      '.persistent-player',
      '.stream-display-ad-manager',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    const video = document.querySelector('video');
    if (video) {
      let parent = video.parentElement;
      while (parent && parent !== document.body) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    return null;
  }

  exports.findPlayer = findPlayer;

})(window.__TD_PLAYER__ = window.__TD_PLAYER__ || {});
