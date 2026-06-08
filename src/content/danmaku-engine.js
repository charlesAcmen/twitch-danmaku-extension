/**
 * danmaku-engine.js
 * 纯粹的弹幕渲染引擎。
 * 只负责维护轨道、计算碰撞并渲染 DOM，不关心宿主环境。
 */
(function (exports) {
  'use strict';

  class DanmakuEngine {
    constructor(container, config) {
      this.container = container;
      this.config = config;
      this.tracks = [];
      this.messageCount = 0;
      this._initTracks();
    }

    _initTracks() {
      this.tracks = new Array(this.config.maxTracks).fill(null).map(() => ({
        lastEndTime: 0,
        lastStartTime: 0,
      }));
    }

    updateConfig(newConfig) {
      const oldMaxTracks = this.config.maxTracks;
      this.config = { ...this.config, ...newConfig };
      if (this.config.maxTracks !== oldMaxTracks) {
        this._initTracks();
      }
    }

    clear() {
      this.container.innerHTML = '';
      this._initTracks();
    }

    _pickTrack() {
      const now = Date.now();
      let bestTrack = -1;
      let bestFreeTime = -1;

      for (let i = 0; i < this.config.maxTracks; i++) {
        const track = this.tracks[i];
        const freeTime = now - track.lastEndTime;
        if (freeTime > bestFreeTime) {
          bestFreeTime = freeTime;
          bestTrack = i;
        }
      }

      if (bestFreeTime < 300) {
        return Math.floor(Math.random() * this.config.maxTracks);
      }
      return bestTrack;
    }

    add(text, color) {
      if (!this.config.enabled || !this.container || !this.container.parentElement) return;

      const containerRect = this.container.getBoundingClientRect();
      if (containerRect.width === 0) return;

      const trackIndex = this._pickTrack();
      if (trackIndex === -1) return;

      const item = document.createElement('span');
      item.className = 'danmaku-item';
      item.textContent = text;

      const fontSize = this.config.fontSize;
      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * (fontSize + 10);
      const duration = Math.max(3, this.config.speed + (text.length > 20 ? -1 : text.length > 10 ? 0 : 1));

      item.style.top = trackTop + 'px';
      item.style.fontSize = fontSize + 'px';
      item.style.setProperty('--danmaku-start-x', containerRect.width + 'px');
      item.style.setProperty('--danmaku-end-x', '-100%');
      item.style.setProperty('--danmaku-duration', duration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);

      if (color) {
        item.style.color = color;
      }

      const estimatedWidth = text.length * fontSize * 0.6;
      const passTime = (estimatedWidth / (containerRect.width + estimatedWidth)) * duration * 1000;
      this.tracks[trackIndex].lastEndTime = Date.now() + passTime + 200;
      this.tracks[trackIndex].lastStartTime = Date.now();

      this.container.appendChild(item);
      this.messageCount++;

      item.addEventListener('animationend', () => item.remove());
      setTimeout(() => { if (item.parentElement) item.remove(); }, (duration + 1) * 1000);
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
