/**
 * ui.js
 * 负责创建、管理弹幕的控制 UI，与配置模块和引擎模块解耦。
 */
(function (exports) {
  'use strict';

  // ── Dynamic font detection using Local Font Access API ──────────────
  // Fallback fonts when Local Font Access API is unavailable
  const FALLBACK_FONTS = [
    { label: '微软雅黑', value: '"Microsoft YaHei", "微软雅黑", sans-serif', family: 'Microsoft YaHei' },
    { label: 'Arial', value: 'Arial, sans-serif', family: 'Arial' },
    { label: 'Georgia', value: 'Georgia, serif', family: 'Georgia' },
    { label: 'Verdana', value: 'Verdana, sans-serif', family: 'Verdana' },
    { label: 'Times New Roman', value: '"Times New Roman", serif', family: 'Times New Roman' },
  ];

  let _availableFonts = null; // cached
  let _fontLoadingPromise = null; // prevent concurrent requests

  /**
   * Filter out symbol/icon fonts that would display as gibberish
   */
  function isTextFont(fontData) {
    const family = fontData.family.toLowerCase();
    
    // Exclude symbol and icon fonts
    const symbolKeywords = [
      'symbol', 'wingding', 'webding', 'dingbat', 'emoji', 'icon',
      'material', 'fontawesome', 'awesome', 'glyphicon', 'pictogram'
    ];
    
    // Check if font name contains symbol keywords
    if (symbolKeywords.some(keyword => family.includes(keyword))) {
      return false;
    }
    
    // Exclude fonts with only special characters in name
    if (/^[\x00-\x1F\x7F-\x9F]+$/.test(fontData.family)) {
      return false;
    }
    
    return true;
  }

  /**
   * Query system fonts using Local Font Access API
   * Falls back to a hardcoded list if API is unavailable
   */
  async function querySystemFonts() {
    // Check if Local Font Access API is available
    if (!('queryLocalFonts' in window)) {
      console.warn('[Twitch Danmaku] Local Font Access API not available, using fallback fonts');
      return FALLBACK_FONTS;
    }

    try {
      // Request permission and query local fonts
      const availableFonts = await window.queryLocalFonts();
      
      // Create a unique set of font families (deduplicate by family name)
      const uniqueFontMap = new Map();
      
      for (const fontData of availableFonts) {
        // Filter out symbol/icon fonts
        if (!isTextFont(fontData)) {
          continue;
        }
        
        const family = fontData.family;
        if (!uniqueFontMap.has(family)) {
          // Create font entry with proper CSS value
          uniqueFontMap.set(family, {
            label: family,
            value: family.includes(' ') ? `"${family}", sans-serif` : `${family}, sans-serif`,
            family: family
          });
        }
      }
      
      // Convert map to array and sort alphabetically
      const fontList = Array.from(uniqueFontMap.values()).sort((a, b) => 
        a.family.localeCompare(b.family, undefined, { sensitivity: 'base' })
      );
      
      console.log(`[Twitch Danmaku] Loaded ${fontList.length} system fonts (filtered out symbol fonts)`);
      return fontList.length > 0 ? fontList : FALLBACK_FONTS;
      
    } catch (error) {
      // User denied permission or API error
      console.warn('[Twitch Danmaku] Failed to query local fonts:', error.message);
      return FALLBACK_FONTS;
    }
  }

  /**
   * Get available fonts (with caching and async loading)
   * Returns a Promise that resolves to font list
   */
  function getAvailableFonts() {
    if (_availableFonts) {
      return Promise.resolve(_availableFonts);
    }
    
    if (_fontLoadingPromise) {
      return _fontLoadingPromise;
    }
    
    _fontLoadingPromise = querySystemFonts().then(fonts => {
      _availableFonts = fonts;
      _fontLoadingPromise = null;
      return fonts;
    }).catch(error => {
      console.error('[Twitch Danmaku] Error loading fonts:', error);
      _availableFonts = FALLBACK_FONTS;
      _fontLoadingPromise = null;
      return FALLBACK_FONTS;
    });
    
    return _fontLoadingPromise;
  }

  // ── Speed stage mapping ───────────────────────────────────────────────
  const SPEED_VALUES  = [11, 8.5, 6.5, 4.8, 3.2];
  const SPEED_LABELS  = ['极慢', '较慢', '适中', '较快', '极快'];

  function speedToIndex(speed) {
    if (typeof speed !== 'number') return 2; // default to 适中
    return SPEED_VALUES.reduce((bestIndex, value, index) => {
      const bestDistance = Math.abs(SPEED_VALUES[bestIndex] - speed);
      const distance = Math.abs(value - speed);
      return distance < bestDistance ? index : bestIndex;
    }, 2);
  }

  class DanmakuUI {
    constructor(config, onConfigChange, onToggle, onReset) {
      this.config = config;
      this.onConfigChange = onConfigChange;
      this.onToggle = onToggle;
      this.onReset = onReset;

      this.toggleBtn = null;
      this.settingsPanel = null;

      this._createControls();
    }

    _createControls() {
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.className = 'danmaku-toggle-btn' + (this.config.enabled ? '' : ' danmaku-off');
      this.toggleBtn.title = '弹幕开关';
      this.toggleBtn.textContent = '弹';
      
      // Left click: toggle danmaku on/off
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleToggle();
      });
      
      // Right click: toggle settings panel
      this.toggleBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._togglePanel();
      });

      // Create settings panel
      this.settingsPanel = document.createElement('div');
      this.settingsPanel.className = 'danmaku-settings-panel';
      
      // Prevent clicks inside panel from closing it
      this.settingsPanel.addEventListener('click', e => e.stopPropagation());
      
      // Close panel when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.settingsPanel.classList.contains('visible')) return;
        if (this.settingsPanel.contains(e.target) || this.toggleBtn.contains(e.target)) return;
        this._closePanel();
      });
    }

    _togglePanel() {
      const isVisible = this.settingsPanel.classList.contains('visible');
      if (isVisible) {
        this._closePanel();
      } else {
        this._openPanel();
      }
    }

    _openPanel() {
      this._renderPanelContent().then(() => {
        this.settingsPanel.classList.add('visible');
      });
    }

    _closePanel() {
      this.settingsPanel.classList.remove('visible');
    }

    async _renderPanelContent() {
      const speedIdx = speedToIndex(this.config.speed);
      
      // Show loading state while fonts are being queried
      this.settingsPanel.innerHTML = `
        <h3>💬 弹幕设置</h3>
        <div class="danmaku-setting-row">
          <label>弹幕字体</label>
          <div class="danmaku-font-controls">
            <select data-setting="fontFamily" class="danmaku-select" disabled>
              <option>正在加载字体列表...</option>
            </select>
          </div>
        </div>
      `;
      
      // Load fonts asynchronously
      const availFonts = await getAvailableFonts();
      const fontOptionsHTML = availFonts.map(f =>
        `<option value='${f.value}' style="font-family: ${f.value};" ${this.config.fontFamily === f.value ? 'selected' : ''}>${f.label}</option>`
      ).join('');

      this.settingsPanel.innerHTML = `
        <h3>💬 弹幕设置</h3>

        <div class="danmaku-setting-row">
          <label>显示区域</label>
          <input type="range" min="0" max="4" step="1"
            value="${[10, 25, 50, 75, 100].indexOf(this.config.displayAreaPercent)}"
            data-setting="displayAreaPercent">
          <span class="setting-value">${this.config.displayAreaPercent}%</span>
        </div>

        <div class="danmaku-setting-row">
          <label>不透明度</label>
          <input type="range" min="10" max="100"
            value="${this.config.opacity * 100}" data-setting="opacity">
          <span class="setting-value">${Math.round(this.config.opacity * 100)}%</span>
        </div>

        <div class="danmaku-setting-row">
          <label>弹幕字号</label>
          <input type="range" min="50" max="170" step="1"
            value="${this.config.fontSizePercent}" data-setting="fontSizePercent">
          <span class="setting-value">${this.config.fontSizePercent}%</span>
        </div>

        <div class="danmaku-setting-row">
          <label>弹幕速度</label>
          <input type="range" min="0" max="4" step="1"
            value="${speedIdx}" data-setting="speed">
          <span class="setting-value">${SPEED_LABELS[speedIdx]}</span>
        </div>

        <div class="danmaku-setting-row">
          <label>弹幕字体</label>
          <div class="danmaku-font-controls">
            <select data-setting="fontFamily" class="danmaku-select">
              ${fontOptionsHTML}
            </select>
            <label class="danmaku-checkbox-label">
              <input type="checkbox" data-setting="fontWeight"
                ${this.config.fontWeight === 'bold' ? 'checked' : ''}> 粗体
            </label>
          </div>
        </div>

        <div class="danmaku-setting-row">
          <label>发送者 ID</label>
          <label class="danmaku-checkbox-label">
            <input type="checkbox" data-setting="showSender"
              ${this.config.showSender !== false ? 'checked' : ''}> 显示
          </label>
        </div>

        <div class="danmaku-setting-row">
          <label>描边类型</label>
          <div class="danmaku-btn-group" data-setting="strokeType">
            <button class="danmaku-btn ${this.config.strokeType === 'heavy'   ? 'active' : ''}" data-value="heavy">重墨</button>
            <button class="danmaku-btn ${this.config.strokeType === 'outline' ? 'active' : ''}" data-value="outline">描边</button>
            <button class="danmaku-btn ${this.config.strokeType === 'shadow'  ? 'active' : ''}" data-value="shadow">45°投影</button>
          </div>
        </div>

        <div class="danmaku-divider"></div>

        <div class="danmaku-setting-row reset-row">
          <button class="danmaku-btn reset-btn" id="danmaku-reset-btn">恢复默认设置</button>
        </div>
      `;

      this._bindEvents();
    }

    _bindEvents() {
      // Range sliders
      this.settingsPanel.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          const setting = e.target.dataset.setting;
          const rawVal = parseInt(e.target.value);
          const valueDisplay = e.target.nextElementSibling;
          const changes = {};

          if (setting === 'displayAreaPercent') {
            const areas = [10, 25, 50, 75, 100];
            changes.displayAreaPercent = areas[rawVal];
            valueDisplay.textContent = areas[rawVal] + '%';
          } else if (setting === 'opacity') {
            changes.opacity = rawVal / 100;
            valueDisplay.textContent = rawVal + '%';
          } else if (setting === 'fontSizePercent') {
            changes.fontSizePercent = rawVal;
            valueDisplay.textContent = rawVal + '%';
          } else if (setting === 'speed') {
            changes.speed = SPEED_VALUES[rawVal];
            valueDisplay.textContent = SPEED_LABELS[rawVal];
          }
          this._dispatchChange(changes);
        });
      });

      // Button groups
      this.settingsPanel.querySelectorAll('.danmaku-btn-group').forEach(group => {
        const setting = group.dataset.setting;
        group.querySelectorAll('.danmaku-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            group.querySelectorAll('.danmaku-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._dispatchChange({ [setting]: btn.dataset.value });
          });
        });
      });

      // Font family select
      const select = this.settingsPanel.querySelector('select[data-setting="fontFamily"]');
      if (select) {
        // Set initial font style for the select element
        select.style.fontFamily = this.config.fontFamily || 'inherit';
        
        select.addEventListener('change', (e) => {
          // Update the select element's own font when changed
          e.target.style.fontFamily = e.target.value;
          this._dispatchChange({ fontFamily: e.target.value });
        });
      }

      // Bold checkbox
      const checkbox = this.settingsPanel.querySelector('input[type="checkbox"][data-setting="fontWeight"]');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          this._dispatchChange({ fontWeight: e.target.checked ? 'bold' : 'normal' });
        });
      }

      const showSenderCheckbox = this.settingsPanel.querySelector('input[type="checkbox"][data-setting="showSender"]');
      if (showSenderCheckbox) {
        showSenderCheckbox.addEventListener('change', (e) => {
          this._dispatchChange({ showSender: e.target.checked });
        });
      }

      // Reset button
      const resetBtn = this.settingsPanel.querySelector('#danmaku-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (!this.onReset) return;
          const defaults = this.onReset();
          if (!defaults) return;
          this.config = { ...defaults };
          this.toggleBtn.classList.toggle('danmaku-off', !this.config.enabled);
          // Re-render with async call
          this._renderPanelContent();
        });
      }
    }

    _dispatchChange(changes) {
      this.config = { ...this.config, ...changes };
      this.onConfigChange(changes);
    }

    _handleToggle() {
      const isEnabled = !this.toggleBtn.classList.contains('danmaku-off');
      if (isEnabled) {
        this.toggleBtn.classList.add('danmaku-off');
      } else {
        this.toggleBtn.classList.remove('danmaku-off');
      }
      this.onToggle(!isEnabled);
    }

    mount(parent) {
      parent.appendChild(this.toggleBtn);
      parent.appendChild(this.settingsPanel);
    }
  }
  exports.DanmakuUI = DanmakuUI;

})(window.__TD_UI__ = window.__TD_UI__ || {});
