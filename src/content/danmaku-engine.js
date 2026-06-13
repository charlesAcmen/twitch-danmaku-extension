/**
 * danmaku-engine.js
 * A small, environment-agnostic danmaku (bullet chat) rendering engine.
 *
 * Responsibilities:
 * - Buffer incoming messages into scroll and fixed queues.
 * - Compute safe tracks and collision-free placement for scrolling messages.
 * - Create DOM elements for messages and apply animation CSS variables.
 * - Expose a simple `add(...)` API for ingestion; keep DOM rendering local to the engine.
 *
 * Design notes / required features:
 * - Configurable options include enabling/disabling, sizing, speed, opacity and queue limits.
 * - Two message types are supported: `scroll` (left-to-right or right-to-left animation) and
 *   `fixed-top` (pinned messages for important roles).
 * - Engine uses `requestAnimationFrame` tick loop only while there are queued messages.
 * - Queue overflow policy: drop oldest messages to preserve realtime feel and avoid unbounded memory.
 * - Track selection tries to balance even distribution, minimize collisions and avoid tight gaps.
 * - Exported under `window.__TD_ENGINE__.DanmakuEngine` for easy integration.
 */
(function (exports) {
  'use strict';

  /**
   * Escape text content for safe HTML injection.
   * @param {string} str
   * @returns {string}
   */
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

  /**
   * Build inner HTML for a message replacing emote ranges with <img> tags.
   * Expects emotes to be objects with {id, start, end} (Twitch-style inclusive indices).
   * Overlaps are skipped conservatively.
   * @param {string} text
   * @param {Array<{id:string,start:number,end:number}>} emotes
   * @returns {string} safe HTML
   */
  /**
   * Build inner HTML for a message replacing emote ranges with <img> tags.
   * Expects emotes to be objects with {id, start, end} (Twitch-style inclusive indices).
   * Overlaps are skipped conservatively. Supports third-party emotes from cache.
   * 
   * 为消息构建内部 HTML，将表情范围替换为 <img> 标签。
   * 期望表情是具有 {id, start, end} 的对象（Twitch 风格的包含索引）。
   * 保守地跳过重叠。支持来自缓存的第三方表情。
   * 
   * @param {string} text - The message text / 消息文本
   * @param {Array<{id:string,start:number,end:number}>} emotes - Twitch emotes / Twitch 表情
   * @returns {string} - Safe HTML / 安全的 HTML
   */
  function createContentHTML(text, emotes) {
    // Input validation / 输入验证
    if (typeof text !== 'string') {
      console.warn('[Twitch Danmaku] Invalid text input to createContentHTML');
      return '';
    }

    const emoteCache = window.__TD_EMOTE_CACHE__ || {};
    const allEmotes = [];

    // 1. Ingest official Twitch emotes
    // 1. 获取官方 Twitch 表情
    if (emotes && Array.isArray(emotes) && emotes.length > 0) {
      for (const e of emotes) {
        if (!e || typeof e.id === 'undefined' || typeof e.start !== 'number' || typeof e.end !== 'number') {
          continue; // Skip invalid emote objects / 跳过无效的表情对象
        }
        allEmotes.push({
          id: e.id,
          src: `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`,
          start: e.start,
          end: e.end, // inclusive index
          ratio: 1
        });
      }
    }

    // 2. Tokenize text to find matches for third-party emotes
    // Emotes must be standalone words separated by spaces.
    // 2. 对文本进行词法分析以查找第三方表情的匹配项
    // 表情必须是由空格分隔的独立单词。
    const words = [];
    let currentWord = '';
    let wordStart = -1;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        if (currentWord.length > 0) {
          words.push({ text: currentWord, start: wordStart, end: i - 1 });
          currentWord = '';
          wordStart = -1;
        }
      } else {
        if (wordStart === -1) {
          wordStart = i;
        }
        currentWord += char;
      }
    }
    if (currentWord.length > 0) {
      words.push({ text: currentWord, start: wordStart, end: text.length - 1 });
    }

    // Check words against third-party emote cache
    // 根据第三方表情缓存检查单词
    for (const w of words) {
      // Check if word index overlaps with any official Twitch emote
      // 检查单词索引是否与任何官方 Twitch 表情重叠
      const isOfficial = allEmotes.some(e => w.start <= e.end && w.end >= e.start);
      if (isOfficial) continue;

      // Check if word is a cached third-party emote
      // 检查单词是否是缓存的第三方表情
      const cached = emoteCache[w.text];
      if (cached && cached.src) {
        allEmotes.push({
          id: null,
          src: cached.src,
          start: w.start,
          end: w.end, // inclusive index
          ratio: cached.ratio || 1
        });
      }
    }

    if (allEmotes.length === 0) {
      return escapeHTML(text);
    }

    // 3. Sort all emotes by start index
    // 3. 按起始索引对所有表情排序
    const sorted = allEmotes.sort((a, b) => a.start - b.start);
    let html = '';
    let currentIndex = 0;

    for (const emote of sorted) {
      const start = emote.start;
      const end = emote.end + 1; // Convert to exclusive index for slicing / 转换为切片的独占索引

      if (start < currentIndex) continue; // Safety: skip overlaps / 安全：跳过重叠

      if (start > currentIndex) {
        html += escapeHTML(text.slice(currentIndex, start));
      }

      // Render with explicit inline width and height using aspect ratio to prevent layout shifting
      // 使用宽高比渲染显式内联宽度和高度以防止布局偏移
      const ratio = emote.ratio || 1;
      const widthEm = 1.2 * ratio;
      const escapedSrc = escapeHTML(emote.src);
      html += `<img src="${escapedSrc}" class="danmaku-emote" style="width: ${widthEm}em; height: 1.2em;" />`;
      currentIndex = end;
    }

    if (currentIndex < text.length) {
      html += escapeHTML(text.slice(currentIndex));
    }

    return html;
  }

  /**
   * DanmakuEngine
   * @param {HTMLElement} container DOM element where message nodes will be appended
   * @param {Object} config engine configuration overrides
   *
   * Supported config fields (defaults shown where applicable):
   * - enabled: true - whether the engine should accept messages
   * - maxQueueSize: 500 - maximum buffered messages per queue
   * - fontSizePercent: 100 - base font size percentage (multiplied by container scale)
   * - displayAreaPercent: 100 - percent of container height used for tracks
   * - verticalStart: 0 - top offset (as fraction of container height) for starting tracks
   * - speed: 8 - nominal seconds it takes a message to traverse container width
   * - opacity: 1 - CSS opacity applied to messages
   * - showSender: true - whether to display username prefix
   * - fontFamily, fontWeight, strokeType - visual styling controls
   */
  class DanmakuEngine {
    constructor(container, config) {
      this.container = container;
      // Relax queue size to 500 by default to tolerate short bursts.
      this.config = { enabled: true, fontSizePercent: 100, displayAreaPercent: 100, verticalStart: 0, speed: 8, opacity: 1, maxQueueSize: 500, showSender: true, ...config };
      this.tracks = []; // array of { activeItems: [], lastStartTime }
      this.fixedSlots = []; // for pinned/fixed messages
      this.scrollQueue = [];  // scrolling messages buffer
      this.fixedQueue = [];   // pinned messages buffer
      this.messageCount = 0;
      this.isRunning = false;
      this._boundTick = this._tick.bind(this);
      
      this.domPool = []; // Pool of inactive DOM elements for reuse

      // Simple telemetry
      this.stats = {
        received: 0,
        rendered: 0,
        dropped: 0
      };
      this.droppedSinceLastLog = [];
      this.lastLogTime = Date.now();
    }

    /**
     * Merge new configuration values at runtime.
     * @param {Object} newConfig
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    /**
     * Clear all state and stop the engine.
     */
    clear() {
      if (this.container) {
        // Release all active elements in the container back to the pool
        const activeNodes = Array.from(this.container.children);
        for (const node of activeNodes) {
          this._releaseNode(node);
        }
      }
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

    /**
     * Animation frame tick: process queues and schedule next tick if work remains.
     * Also rate-limited logging for dropped items to avoid console spam.
     */
    _tick() {
      if (!this.isRunning) return;
      this._processQueue();

      const now = Date.now();
      if (now - this.lastLogTime > 2000 && this.droppedSinceLastLog.length > 0) {
        // console.warn(`[Twitch Danmaku] Queue max capacity (${this.config.maxQueueSize}) reached. Dropped ${this.droppedSinceLastLog.length} oldest messages in the last 2s to maintain real-time sync. Total dropped: ${this.stats.dropped}`, this.droppedSinceLastLog);
        this.droppedSinceLastLog = [];
        this.lastLogTime = now;
      }

      if (this.scrollQueue.length === 0 && this.fixedQueue.length === 0) {
        this._stop();
        return;
      }

      requestAnimationFrame(this._boundTick);
    }

    /**
     * Ensure track object exists at index.
     * @private
     */
    _ensureTrack(trackIndex) {
      if (!this.tracks[trackIndex]) {
        this.tracks[trackIndex] = { activeItems: [], lastStartTime: 0 };
      }
      return this.tracks[trackIndex];
    }

    /**
     * Remove expired items from a track.
     * @private
     */
    _pruneTrack(track, now) {
      track.activeItems = track.activeItems.filter(item => item.endTime > now);
    }

    /**
     * Decide if a track is safe to place a new message into. Safety is based on a minimum
     * pixel gap and relative speeds of existing items.
     * @private
     */
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

    /**
     * Retrieve a node from the DOM pool, or create a new one if the pool is empty.
     * @private
     * @returns {HTMLElement}
     */
    _getPooledNode() {
      if (this.domPool.length > 0) {
        const node = this.domPool.pop();
        node.className = '';
        node.style.cssText = '';
        return node;
      }
      return document.createElement('span');
    }

    /**
     * Clean up and return a node to the DOM pool.
     * @private
     * @param {HTMLElement} node
     */
    _releaseNode(node) {
      if (node._timeoutId) {
        clearTimeout(node._timeoutId);
        node._timeoutId = null;
      }
      node.onanimationend = null;
      if (node.parentElement) {
        node.parentElement.removeChild(node);
      }
      node.innerHTML = '';
      node.style.cssText = '';
      this.domPool.push(node);
    }

    /**
     * Pick a suitable track index from available tracks. Returns -1 if none available.
     * Deterministic first-safe-track top-down algorithm.
     * @private
     */
    _pickTrack(effectiveMaxTracks, speedPxPerSecond) {
      const now = Date.now();

      for (let i = 0; i < effectiveMaxTracks; i++) {
        const track = this._ensureTrack(i);
        this._pruneTrack(track, now);

        if (this._isTrackSafe(track, speedPxPerSecond, now)) {
          return i;
        }
      }

      return -1;
    }

    /**
     * Find an available fixed slot index for pinned messages.
     * Returns -1 if none available.
     * @private
     */
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

    /**
     * Ingest a message into the appropriate queue. This method performs only data work
     * and does not attempt to mutate layout until the tick loop runs.
     *
     * @param {string} username
     * @param {string} text
     * @param {string} color
     * @param {Array} emotes
     * @param {string} role - optional role string (e.g. 'moderator'|'broadcaster')
     */
    add(username, text, color, emotes = [], role = 'normal') {
      if (!this.config.enabled) return;

      this.stats.received++;
      const type = (role === 'broadcaster' || role === 'moderator') ? 'fixed-top' : 'scroll';
      const queue = type === 'fixed-top' ? this.fixedQueue : this.scrollQueue;

      queue.push({ username, text, color, emotes, type, timestamp: Date.now() });

      // Overflow protection: drop oldest items when maxQueueSize exceeded.
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

      // Start tick loop if not already running
      if (!this.isRunning) {
        this._start();
      }
    }

    /**
     * Main queue processor: calculate layout, create DOM nodes and schedule animations.
     * @private
     */
    _processQueue() {
      if (this.scrollQueue.length === 0 && this.fixedQueue.length === 0) return;
      if (!this.container || !this.container.parentElement) return;

      const containerRect = this.container.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;

      // 1. Adaptive Font Size: scale base font by container height
      const scale = containerRect.height / 720;
      const baseFontSize = 24 * (this.config.fontSizePercent / 100);
      const actualFontSize = Math.max(12, Math.floor(baseFontSize * scale));
      const trackHeight = actualFontSize + 10;

      // 2. Compute available tracks within configured display area
      const topPadding = containerRect.height * this.config.verticalStart;
      const availableSpace = (containerRect.height * (this.config.displayAreaPercent / 100)) - topPadding;
      const effectiveMaxTracks = Math.max(1, Math.floor(availableSpace / trackHeight));

      // 3. Place any pending fixed (pinned) messages
      while (this.fixedQueue.length > 0) {
        const slotIndex = this._pickFixedSlot(effectiveMaxTracks);
        if (slotIndex === -1) break;
        const itemData = this.fixedQueue.shift();
        this._renderFixedItem(itemData, slotIndex, containerRect, actualFontSize);
      }

      // 4. Place scrolling messages. If no track is available, bail and retry later.
      while (this.scrollQueue.length > 0) {
        const itemData = this.scrollQueue[0];
        const item = this._createItemElement(itemData, 'danmaku-item', actualFontSize);
        this.container.appendChild(item);

        const messageWidth = item.offsetWidth;
        const speedPxPerSecond = containerRect.width / this.config.speed;
        const trackIndex = this._pickTrack(effectiveMaxTracks, speedPxPerSecond);
        if (trackIndex === -1) {
          this._releaseNode(item); // Release back to DOM pool instead of destroying
          break;
        }

        this.scrollQueue.shift();
        this._renderItem(trackIndex, containerRect, trackHeight, item, messageWidth, speedPxPerSecond);
      }
    }

    /**
     * Create a message element and apply initial styles. The element is hidden until placed.
     * @private
     */
    _createItemElement(data, className, fontSize) {
      const { username, text, color, emotes } = data;

      const item = this._getPooledNode();
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

    /**
     * Apply font and stroke styles to item based on config.
     * Adds comprehensive emoji and special character fallback fonts.
     * @private
     */
    _applyItemStyles(item, fontSize) {
      // Build font-family with comprehensive fallbacks for emoji and special characters
      const userFont = this.config.fontFamily || '"Microsoft YaHei", sans-serif';
      
      // Add comprehensive fallback chain for emoji and special Unicode characters
      // This ensures rare/new emoji (like 🫪) render correctly
      const emojiFallbacks = [
        'Apple Color Emoji',      // iOS/macOS emoji
        'Segoe UI Emoji',         // Windows 10+ emoji
        'Segoe UI Symbol',        // Windows symbols
        'Noto Color Emoji',       // Android/Linux emoji
        'Android Emoji',          // Older Android
        'EmojiOne Color',         // EmojiOne font
        'Twemoji Mozilla',        // Firefox emoji
        'sans-serif'              // Final fallback
      ].map(f => f.includes(' ') ? `"${f}"` : f).join(', ');
      
      // Combine: user font first, then emoji fallbacks
      item.style.fontFamily = `${userFont}, ${emojiFallbacks}`;
      item.style.fontWeight = this.config.fontWeight || 'normal';
      item.style.fontSize = fontSize + 'px';
      
      // Apply stroke class (CSS must provide the visuals)
      item.classList.remove('stroke-heavy', 'stroke-outline', 'stroke-shadow');
      const stroke = this.config.strokeType || 'outline';
      item.classList.add('stroke-' + stroke);
    }

    /**
     * Render a fixed (pinned) message into a top-aligned slot.
     * Pinned messages stay for a short fixed duration.
     * @private
     */
    _renderFixedItem(data, slotIndex, containerRect, actualFontSize) {
      const item = this._createItemElement(data, 'danmaku-item fixed-top', actualFontSize);

      const topPadding = containerRect.height * this.config.verticalStart;
      const slotHeight = actualFontSize + 10;
      const trackTop = topPadding + slotIndex * slotHeight;

      item.style.top = trackTop + 'px';
      item.style.setProperty('--danmaku-opacity', this.config.opacity);
      item.style.visibility = '';

      this.container.appendChild(item);

      const stayDuration = 5; // 5 seconds pinned by default
      this.fixedSlots[slotIndex].lastEndTime = Date.now() + (stayDuration * 1000);

      this.messageCount++;
      this.stats.rendered++;

      item.onanimationend = () => {
        this._releaseNode(item);
      };

      const timeoutId = setTimeout(() => {
        item._timeoutId = null;
        this._releaseNode(item);
      }, (stayDuration + 1) * 1000);
      item._timeoutId = timeoutId;
    }

    /**
     * Place a scrolling message on a track and schedule its removal.
     * @private
     */
    _renderItem(trackIndex, containerRect, trackHeight, item, messageWidth, speedPxPerSecond) {
      const trackTop = this.config.verticalStart * containerRect.height + trackIndex * trackHeight;
      item.style.top = trackTop + 'px';

      const containerWidth = containerRect.width;
      const totalDuration = (containerWidth + messageWidth) / speedPxPerSecond;

      // Provide CSS variables so host CSS can animate using transform / keyframes
      item.style.setProperty('--danmaku-start-x', containerWidth + 'px');
      item.style.setProperty('--danmaku-end-x', `-${messageWidth}px`);
      item.style.setProperty('--danmaku-duration', totalDuration + 's');
      item.style.setProperty('--danmaku-opacity', this.config.opacity);

      item.style.visibility = ''; // Reveal element

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

      item.onanimationend = () => {
        this._releaseNode(item);
      };

      const timeoutId = setTimeout(() => {
        item._timeoutId = null;
        this._releaseNode(item);
      }, (totalDuration + 1) * 1000);
      item._timeoutId = timeoutId;
    }
  }

  exports.DanmakuEngine = DanmakuEngine;

})(window.__TD_ENGINE__ = window.__TD_ENGINE__ || {});
