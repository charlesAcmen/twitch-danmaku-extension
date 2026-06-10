/**
 * danmaku-engine.js
 * Pure danmaku rendering engine with RequestAnimationFrame Buffer Queue.
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
      // Default maxQueueSize to 100 if not provided
      this.config = { maxQueueSize: 100, ...config };
      this.tracks = []; // dynamically grown
      this.queue = [];  // Message buffer queue
      this.messageCount = 0;
      this.isRunning = false;
      this._boundTick = this._tick.bind(this);

      // Telemetry for dropped messages
      this.stats = {
        received: 0,
        rendered: 0,
        dropped: 0
      };
      this.droppedSinceLastLog = [];
      this.lastLogTime = Date.now();
    }

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    clear() {
      this.container.innerHTML = '';
      this.tracks = [];
      this.queue = [];
    }

    _start() {
      if (this.isRunning) return;
      this.isRunning = true;
      requestAnimationFrame(this._boundTick);
    }

    _stop() {
      this.isRunning = false;
    }

    _tick() {
      if (!this.isRunning) return;
      this._processQueue();

      // Log dropped messages periodically to prevent console lag
      const now = Date.now();
      if (now - this.lastLogTime > 2000 && this.droppedSinceLastLog.length > 0) {
        console.warn(`[Twitch Danmaku] Queue max capacity (${this.config.maxQueueSize}) reached. Dropped ${this.droppedSinceLastLog.length} oldest messages in the last 2s to maintain real-time sync. Total dropped: ${this.stats.dropped}`, this.droppedSinceLastLog);
        this.droppedSinceLastLog = [];
        this.lastLogTime = now;
      }

      requestAnimationFrame(this._boundTick);
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

      // STRICT MODE: Only return a track if it's genuinely free.
      // (freeTime > 0 means the tail of the previous danmaku has passed the padding threshold)
      if (bestFreeTime > 0) {
        return bestTrack;
      }
      
      // If no tracks are free, return -1. We will NOT force overlap anymore.
      return -1;
    }

    // This is now purely a data ingester. No DOM work here.
    add(username, text, color, emotes = []) {
      if (!this.config.enabled) return;

      this.stats.received++;
      this.queue.push({ username, text, color, emotes });

      // Overflow protection: Drop oldest items to maintain real-time sync
      if (this.queue.length > this.config.maxQueueSize) {
        const dropCount = this.queue.length - this.config.maxQueueSize;
        const droppedItems = this.queue.slice(0, dropCount);
        this.queue = this.queue.slice(-this.config.maxQueueSize);
        
        this.stats.dropped += dropCount;
        this.droppedSinceLastLog.push(...droppedItems);
      }

      // Ensure the ticker is running
      if (!this.isRunning) {
        this._start();
      }
    }

    _processQueue() {
      if (this.queue.length === 0) return;
      if (!this.container || !this.container.parentElement) return;

      const containerRect = this.container.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;

      // 1. Adaptive Font Size
      const scale = containerRect.height / 720;
      const baseFontSize = 24 * (this.config.fontSizePercent / 100);
      const actualFontSize = Math.max(12, Math.floor(baseFontSize * scale));
      const trackHeight = actualFontSize + 10;

      // 2. Available Tracks
      const topPadding = containerRect.height * this.config.verticalStart;
      const availableSpace = (containerRect.height * (this.config.displayAreaPercent / 100)) - topPadding;
      const effectiveMaxTracks = Math.max(1, Math.floor(availableSpace / trackHeight));

      // Try to dispatch as many queued items as possible in this frame
      while (this.queue.length > 0) {
        const trackIndex = this._pickTrack(effectiveMaxTracks);
        
        // If NO track is available, we break the loop immediately.
        // The remaining items stay in the queue and will be checked on the next frame.
        if (trackIndex === -1) {
          break;
        }

        // We have a free track! Pop the oldest item from the front of the queue
        const itemData = this.queue.shift();
        this._renderItem(itemData, trackIndex, containerRect, actualFontSize, trackHeight);
      }
    }

    _renderItem(data, trackIndex, containerRect, actualFontSize, trackHeight) {
      const { username, text, color, emotes } = data;

      const item = document.createElement('span');
      item.className = 'danmaku-item';
      
      const authorHtml = `<span class="danmaku-author" style="color: ${color || '#ffffff'};">${escapeHTML(username)}: </span>`;
      const msgHtml = `<span class="danmaku-msg">${createContentHTML(text, emotes)}</span>`;
      item.innerHTML = authorHtml + msgHtml;

      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * trackHeight;
      item.style.top = trackTop + 'px';
      item.style.fontSize = actualFontSize + 'px';
      
      // 3. Exact Width Calculation
      item.style.visibility = 'hidden';
      this.container.appendChild(item);
      
      const W = item.offsetWidth;
      const L = containerRect.width;
      
      // 4. Constant Velocity Algorithm
      const V = L / this.config.speed;
      const totalDuration = (L + W) / V;
      const tailClearTime = W / V;
      
      item.style.setProperty('--danmaku-start-x', L + 'px');
      item.style.setProperty('--danmaku-end-x', `-${W}px`);
      item.style.setProperty('--danmaku-duration', totalDuration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      
      item.style.visibility = ''; // Reveal
      
      // 5. Track Lock with safety padding
      this.tracks[trackIndex].lastEndTime = Date.now() + (tailClearTime + 0.3) * 1000;
      this.tracks[trackIndex].lastStartTime = Date.now();

      this.messageCount++;
      this.stats.rendered++;

      item.addEventListener('animationend', () => item.remove());
      setTimeout(() => { if (item.parentElement) item.remove(); }, (totalDuration + 1) * 1000);
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
