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
      this._stop();
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

      if (this.scrollQueue.length === 0 && this.fixedQueue.length === 0) {
        this._stop();
        return;
      }

      requestAnimationFrame(this._boundTick);
    }

    _ensureTrack(trackIndex) {
      if (!this.tracks[trackIndex]) {
        this.tracks[trackIndex] = { activeItems: [], lastStartTime: 0 };
      }
      return this.tracks[trackIndex];
    }

    _pruneTrack(track, now) {
      track.activeItems = track.activeItems.filter(item => item.endTime > now);
    }

    _isTrackSafe(track, speedPxPerSecond, now) {
      const minGapPx = Math.max(16, speedPxPerSecond * 0.25);

      return track.activeItems.every(item => {
        const elapsedSeconds = Math.max(0, (now - item.startTime) / 1000);
        const remainingSeconds = Math.max(0, item.duration - elapsedSeconds);
        const currentGapPx = item.speedPxPerSecond * elapsedSeconds - item.width;

        if (currentGapPx < minGapPx) {
          return false;
        }

        if (speedPxPerSecond <= item.speedPxPerSecond) {
          return true;
        }

        const closestGapPx = currentGapPx - (speedPxPerSecond - item.speedPxPerSecond) * remainingSeconds;
        return closestGapPx >= minGapPx;
      });
    }

    _pickTrack(effectiveMaxTracks, speedPxPerSecond) {
      const now = Date.now();
      const candidates = [];

      for (let i = 0; i < effectiveMaxTracks; i++) {
        const track = this._ensureTrack(i);
        this._pruneTrack(track, now);

        if (this._isTrackSafe(track, speedPxPerSecond, now)) {
          const recentlyUsedPenalty = Math.max(0, 1500 - (now - track.lastStartTime)) / 1500;
          candidates.push({
            index: i,
            score: track.activeItems.length + recentlyUsedPenalty
          });
        }
      }

      if (candidates.length === 0) return -1;

      const bestScore = Math.min(...candidates.map(candidate => candidate.score));
      const relaxedCandidates = candidates.filter(candidate => candidate.score <= bestScore + 1);
      return relaxedCandidates[Math.floor(Math.random() * relaxedCandidates.length)].index;
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
        const itemData = this.scrollQueue[0];
        const item = this._createItemElement(itemData, 'danmaku-item', actualFontSize);
        this.container.appendChild(item);

        const messageWidth = item.offsetWidth;
        const speedPxPerSecond = containerRect.width / this.config.speed;
        const trackIndex = this._pickTrack(effectiveMaxTracks, speedPxPerSecond);
        if (trackIndex === -1) {
          item.remove();
          break;
        }

        this.scrollQueue.shift();
        this._renderItem(trackIndex, containerRect, trackHeight, item, messageWidth, speedPxPerSecond);
      }
    }

    _createItemElement(data, className, fontSize) {
      const { username, text, color, emotes } = data;

      const item = document.createElement('span');
      item.className = className;

      const authorHtml = this.config.showSender === false
        ? ''
        : `<span class="danmaku-author" style="color: ${color || '#ffffff'};">` + escapeHTML(username) + `: </span>`;
      const msgHtml = `<span class="danmaku-msg">${createContentHTML(text, emotes)}</span>`;
      item.innerHTML = authorHtml + msgHtml;
      item.style.visibility = 'hidden';
      this._applyItemStyles(item, fontSize);

      return item;
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
      const item = this._createItemElement(data, 'danmaku-item fixed-top', actualFontSize);

      const topPadding = containerRect.height * this.config.verticalStart;
      const slotHeight = actualFontSize + 10;
      const trackTop = topPadding + slotIndex * slotHeight;
      
      item.style.top = trackTop + 'px';
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      item.style.visibility = '';
      
      this.container.appendChild(item);
      
      const stayDuration = 5; // 5 seconds
      this.fixedSlots[slotIndex].lastEndTime = Date.now() + (stayDuration * 1000);

      this.messageCount++;
      this.stats.rendered++;

      item.addEventListener('animationend', () => item.remove());
      setTimeout(() => { if (item.parentElement) item.remove(); }, (stayDuration + 1) * 1000);
    }

    _renderItem(trackIndex, containerRect, trackHeight, item, messageWidth, speedPxPerSecond) {
      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * trackHeight;
      item.style.top = trackTop + 'px';

      const containerWidth = containerRect.width;
      const totalDuration = (containerWidth + messageWidth) / speedPxPerSecond;
      
      item.style.setProperty('--danmaku-start-x', containerWidth + 'px');
      item.style.setProperty('--danmaku-end-x', `-${messageWidth}px`);
      item.style.setProperty('--danmaku-duration', totalDuration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      
      item.style.visibility = ''; // Reveal

      const now = Date.now();
      const track = this._ensureTrack(trackIndex);
      track.lastStartTime = now;
      track.activeItems.push({
        startTime: now,
        endTime: now + totalDuration * 1000,
        width: messageWidth,
        speedPxPerSecond,
        duration: totalDuration
      });

      this.messageCount++;
      this.stats.rendered++;

      item.addEventListener('animationend', () => item.remove());
      setTimeout(() => { if (item.parentElement) item.remove(); }, (totalDuration + 1) * 1000);
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
