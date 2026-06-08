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

    const sorted = [...emotes].sort((a, b) => a.start - b.start);
    let html = '';
    let currentIndex = 0;

    for (const emote of sorted) {
      const start = emote.start;
      const end = emote.end + 1; // Twitch indices are inclusive

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
      this.tracks = []; // dynamically grown
      this.messageCount = 0;
    }

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    clear() {
      this.container.innerHTML = '';
      this.tracks = [];
    }

    _pickTrack(effectiveMaxTracks) {
      const now = Date.now();
      let bestTrack = -1;
      let bestFreeTime = -1;

      for (let i = 0; i < effectiveMaxTracks; i++) {
        if (!this.tracks[i]) this.tracks[i] = { lastEndTime: 0, lastStartTime: 0 };
        
        const track = this.tracks[i];
        const freeTime = now - track.lastEndTime;
        if (freeTime > bestFreeTime) {
          bestFreeTime = freeTime;
          bestTrack = i;
        }
      }

      if (bestFreeTime < 300) {
        // All tracks are busy, pick a random one
        return Math.floor(Math.random() * effectiveMaxTracks);
      }
      return bestTrack;
    }

    add(username, text, color, emotes = []) {
      if (!this.config.enabled || !this.container || !this.container.parentElement) return;

      const containerRect = this.container.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;

      // 1. Adaptive Font Size
      // Scale based on a standard 720p player height to handle zoom levels correctly
      const scale = containerRect.height / 720;
      const actualFontSize = Math.max(12, Math.floor(this.config.fontSize * scale)); // Ensure min 12px
      const trackHeight = actualFontSize + 10;

      // 2. Prevent tracks from overflowing the video bottom
      const availableSpace = containerRect.height * (1 - this.config.verticalStart);
      const availableTracks = Math.floor(availableSpace / trackHeight);
      const effectiveMaxTracks = Math.max(1, Math.min(this.config.maxTracks, availableTracks));

      const trackIndex = this._pickTrack(effectiveMaxTracks);
      if (trackIndex === -1) return;

      const item = document.createElement('span');
      item.className = 'danmaku-item';
      
      const authorHtml = `<span class="danmaku-author" style="color: ${color || '#ffffff'};">${escapeHTML(username)}: </span>`;
      const msgHtml = `<span class="danmaku-msg">${createContentHTML(text, emotes)}</span>`;
      item.innerHTML = authorHtml + msgHtml;

      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * trackHeight;
      item.style.top = trackTop + 'px';
      item.style.fontSize = actualFontSize + 'px';
      
      // 3. Exact Width Calculation (Industry Standard)
      // Hide before appending to prevent unstyled flash and layout shift
      item.style.visibility = 'hidden';
      this.container.appendChild(item);
      
      const W = item.offsetWidth;
      const L = containerRect.width;
      
      // 4. Constant Velocity Algorithm to prevent chasing collisions
      // V is pixels per second
      const V = L / this.config.speed;
      const totalDuration = (L + W) / V;
      const tailClearTime = W / V;
      
      item.style.setProperty('--danmaku-start-x', L + 'px');
      item.style.setProperty('--danmaku-end-x', `-${W}px`);
      item.style.setProperty('--danmaku-duration', totalDuration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      
      // Reveal the item
      item.style.visibility = '';
      
      // 5. Update track occupation time with safety padding (0.3s gap)
      this.tracks[trackIndex].lastEndTime = Date.now() + (tailClearTime + 0.3) * 1000;
      this.tracks[trackIndex].lastStartTime = Date.now();

      this.messageCount++;

      item.addEventListener('animationend', () => item.remove());
      // Fallback cleanup in case animationend doesn't fire
      setTimeout(() => { if (item.parentElement) item.remove(); }, (totalDuration + 1) * 1000);
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
