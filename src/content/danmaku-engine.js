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
      // Relax queue size to 500. This handles high-capacity bursts (max speed, min font) 
      // without dropping, and limits max delay to ~10-15s under typical settings.
      this.config = { maxQueueSize: 500, ...config };
      this.tracks = []; // dynamically grown
      this.fixedSlots = []; // dynamically grown for fixed danmaku
      this.scrollQueue = [];  // Scrolling message buffer queue
      this.fixedQueue = [];   // Fixed message buffer queue
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
      this.fixedSlots = [];
      this.scrollQueue = [];
      this.fixedQueue = [];
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
      if (bestFreeTime > 0) {
        return bestTrack;
      }
      return -1;
    }

    _pickFixedSlot(maxSlots) {
      const now = Date.now();
      for (let i = 0; i < maxSlots; i++) {
        if (!this.fixedSlots[i]) this.fixedSlots[i] = { lastEndTime: 0 };
        if (now > this.fixedSlots[i].lastEndTime) {
          return i;
        }
      }
      return -1;
    }

    // This is now purely a data ingester. No DOM work here.
    add(username, text, color, emotes = [], role = 'normal') {
      if (!this.config.enabled) return;

      this.stats.received++;
      const type = (role === 'broadcaster' || role === 'moderator') ? 'fixed-top' : 'scroll';
      const queue = type === 'fixed-top' ? this.fixedQueue : this.scrollQueue;

      queue.push({ username, text, color, emotes, type, timestamp: Date.now() });

      // Overflow protection: Drop oldest items to maintain real-time sync
      if (queue.length > this.config.maxQueueSize) {
        const dropCount = queue.length - this.config.maxQueueSize;
        const droppedItems = queue.slice(0, dropCount);
        
        if (type === 'fixed-top') {
          this.fixedQueue = queue.slice(-this.config.maxQueueSize);
        } else {
          this.scrollQueue = queue.slice(-this.config.maxQueueSize);
        }
        
        this.stats.dropped += dropCount;
        this.droppedSinceLastLog.push(...droppedItems);
      }

      // Ensure the ticker is running
      if (!this.isRunning) {
        this._start();
      }
    }

    _processQueue() {
      if (this.scrollQueue.length === 0 && this.fixedQueue.length === 0) return;
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

      // 3. Process fixed queue
      while (this.fixedQueue.length > 0) {
        const slotIndex = this._pickFixedSlot(effectiveMaxTracks);
        if (slotIndex === -1) break;
        const itemData = this.fixedQueue.shift();
        this._renderFixedItem(itemData, slotIndex, containerRect, actualFontSize);
      }

      // 4. Process scroll queue
      while (this.scrollQueue.length > 0) {
        const trackIndex = this._pickTrack(effectiveMaxTracks);
        if (trackIndex === -1) break;
        const itemData = this.scrollQueue.shift();
        this._renderItem(itemData, trackIndex, containerRect, actualFontSize, trackHeight);
      }
    }

    _applyItemStyles(item, fontSize) {
      item.style.fontFamily = this.config.fontFamily || '"Microsoft YaHei", sans-serif';
      item.style.fontWeight = this.config.fontWeight || 'normal';
      item.style.fontSize = fontSize + 'px';
      // Apply stroke class
      item.classList.remove('stroke-heavy', 'stroke-outline', 'stroke-shadow');
      const stroke = this.config.strokeType || 'outline';
      item.classList.add('stroke-' + stroke);
    }

    _renderFixedItem(data, slotIndex, containerRect, actualFontSize) {
      const { username, text, color, emotes } = data;

      const item = document.createElement('span');
      item.className = 'danmaku-item fixed-top';
      
      const authorHtml = `<span class="danmaku-author" style="color: ${color || '#ffffff'};">` + escapeHTML(username) + `: </span>`;
      const msgHtml = `<span class="danmaku-msg">${createContentHTML(text, emotes)}</span>`;
      item.innerHTML = authorHtml + msgHtml;

      const topPadding = containerRect.height * this.config.verticalStart;
      const slotHeight = actualFontSize + 10;
      const trackTop = topPadding + slotIndex * slotHeight;
      
      item.style.top = trackTop + 'px';
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      this._applyItemStyles(item, actualFontSize);
      
      this.container.appendChild(item);
      
      const stayDuration = 5; // 5 seconds
      this.fixedSlots[slotIndex].lastEndTime = Date.now() + (stayDuration * 1000);

      this.messageCount++;
      this.stats.rendered++;

      item.addEventListener('animationend', () => item.remove());
      setTimeout(() => { if (item.parentElement) item.remove(); }, (stayDuration + 1) * 1000);
    }

    _renderItem(data, trackIndex, containerRect, actualFontSize, trackHeight) {
      const { username, text, color, emotes } = data;

      const item = document.createElement('span');
      item.className = 'danmaku-item';
      
      const authorHtml = `<span class="danmaku-author" style="color: ${color || '#ffffff'};">` + escapeHTML(username) + `: </span>`;
      const msgHtml = `<span class="danmaku-msg">${createContentHTML(text, emotes)}</span>`;
      item.innerHTML = authorHtml + msgHtml;

      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * trackHeight;
      item.style.top = trackTop + 'px';
      
      item.style.visibility = 'hidden';
      this._applyItemStyles(item, actualFontSize);
      this.container.appendChild(item);
      
      const W = item.offsetWidth;
      const L = containerRect.width;
      
      const V = L / this.config.speed;
      const totalDuration = (L + W) / V;
      const tailClearTime = W / V;
      
      item.style.setProperty('--danmaku-start-x', L + 'px');
      item.style.setProperty('--danmaku-end-x', `-${W}px`);
      item.style.setProperty('--danmaku-duration', totalDuration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      
      item.style.visibility = ''; // Reveal
      
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
