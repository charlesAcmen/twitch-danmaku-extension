/**
 * danmaku-engine.js
 * Pure danmaku rendering engine.
 * Maintains tracks, calculates collisions, and renders DOM elements.
 * Unaware of the host environment (Twitch specific DOM).
 */
(function (exports) {
  'use strict';

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
    );
  }

  function createContentHTML(text, emotes) {
    if (!emotes || emotes.length === 0) {
      return escapeHTML(text);
    }

    // Sort ascending by start index
    const sorted = [...emotes].sort((a, b) => a.start - b.start);
    let html = '';
    let currentIndex = 0;

    for (const emote of sorted) {
      const start = emote.start;
      const end = emote.end + 1; // Twitch indices are inclusive, make it exclusive for slice

      if (start < currentIndex) continue; // Safety check for overlaps

      if (start > currentIndex) {
         html += escapeHTML(text.slice(currentIndex, start));
      }

      html += `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0" class="danmaku-emote" />`;
      currentIndex = end;
    }

    if (currentIndex < text.length) {
      html += escapeHTML(text.slice(currentIndex));
    }

    return html;
  }

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
        // All tracks are busy, pick a random one
        return Math.floor(Math.random() * this.config.maxTracks);
      }
      return bestTrack;
    }

    add(text, color, emotes = []) {
      if (!this.config.enabled || !this.container || !this.container.parentElement) return;

      const containerRect = this.container.getBoundingClientRect();
      if (containerRect.width === 0) return;

      const trackIndex = this._pickTrack();
      if (trackIndex === -1) return;

      const item = document.createElement('span');
      item.className = 'danmaku-item';
      item.innerHTML = createContentHTML(text, emotes);

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

      // Estimate width for collision detection
      // A character is roughly 0.6em, an emote image is roughly 1.5em
      const textLength = text.length - emotes.reduce((acc, e) => acc + (e.end - e.start + 1), 0);
      const estimatedWidth = (textLength * fontSize * 0.6) + (emotes.length * fontSize * 1.5);
      
      const passTime = (estimatedWidth / (containerRect.width + estimatedWidth)) * duration * 1000;
      this.tracks[trackIndex].lastEndTime = Date.now() + passTime + 200; // 200ms safety padding
      this.tracks[trackIndex].lastStartTime = Date.now();

      this.container.appendChild(item);
      this.messageCount++;

      item.addEventListener('animationend', () => item.remove());
      // Fallback cleanup in case animationend doesn't fire
      setTimeout(() => { if (item.parentElement) item.remove(); }, (duration + 1) * 1000);
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
