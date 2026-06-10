/**
 * ui.js
 * 负责创建、管理弹幕的控制 UI，与配置模块和引擎模块解耦。
 */
(function (exports) {
  'use strict';

  // ── Font detection using canvas ──────────────────────────────────────
  const FONT_CANDIDATES = [
    // Chinese fonts (from image + common)
    { label: '微软雅黑 Light',  value: '"Microsoft YaHei Light", "Microsoft YaHei", sans-serif', key: 'Microsoft YaHei Light' },
    { label: '微软雅黑',        value: '"Microsoft YaHei", "微软雅黑", sans-serif',              key: 'Microsoft YaHei' },
    { label: '黑体',            value: '"SimHei", "黑体", sans-serif',                            key: 'SimHei' },
    { label: '宋体',            value: '"SimSun", "宋体", serif',                                key: 'SimSun' },
    { label: '新宋体',          value: '"NSimSun", "新宋体", serif',                             key: 'NSimSun' },
    { label: '仿宋',            value: '"FangSong", "仿宋", serif',                              key: 'FangSong' },
    { label: '楷体',            value: '"KaiTi", "楷体", serif',                                key: 'KaiTi' },
    { label: 'PingFang SC',    value: '"PingFang SC", "苹方", sans-serif',                      key: 'PingFang SC' },
    { label: 'Hiragino Sans',  value: '"Hiragino Sans", sans-serif',                            key: 'Hiragino Sans' },
    // Common English fonts
    { label: 'Arial',          value: 'Arial, sans-serif',            key: 'Arial' },
    { label: 'Georgia',        value: 'Georgia, serif',               key: 'Georgia' },
    { label: 'Times New Roman',value: '"Times New Roman", serif',     key: 'Times New Roman' },
    { label: 'Verdana',        value: 'Verdana, sans-serif',          key: 'Verdana' },
    { label: 'Courier New',    value: '"Courier New", monospace',     key: 'Courier New' },
    { label: 'Impact',         value: 'Impact, sans-serif',           key: 'Impact' },
    { label: 'Trebuchet MS',   value: '"Trebuchet MS", sans-serif',   key: 'Trebuchet MS' },
    { label: 'Comic Sans MS',  value: '"Comic Sans MS", cursive',     key: 'Comic Sans MS' },
    { label: 'Palatino',       value: '"Palatino Linotype", serif',   key: 'Palatino Linotype' },
  ];

  function isFontAvailable(fontName) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 300; canvas.height = 60;
      const ctx = canvas.getContext('2d');
      const testStr = 'abcdefghijklmm测试宋体ABCDE12345';
      const SIZE = '48px';

      ctx.font = `${SIZE} monospace`;
      const monoW = ctx.measureText(testStr).width;
      ctx.font = `${SIZE} sans-serif`;
      const sansW = ctx.measureText(testStr).width;

      ctx.font = `${SIZE} '${fontName}', monospace`;
      const fMonoW = ctx.measureText(testStr).width;
      ctx.font = `${SIZE} '${fontName}', sans-serif`;
      const fSansW = ctx.measureText(testStr).width;

      return fMonoW !== monoW || fSansW !== sansW;
    } catch(e) {
      return false;
    }
  }

  let _availableFonts = null; // cached
  function getAvailableFonts() {
    if (_availableFonts) return _availableFonts;
    _availableFonts = FONT_CANDIDATES.filter(f => isFontAvailable(f.key));
    // Always ensure at least a few fallbacks are in the list
    if (_availableFonts.length === 0) {
      _availableFonts = [
        { label: 'Arial', value: 'Arial, sans-serif', key: 'Arial' },
        { label: 'Georgia', value: 'Georgia, serif', key: 'Georgia' },
      ];
    }
    return _availableFonts;
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
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleToggle();
      });
      this.toggleBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._renderPanelContent();
        this.settingsPanel.classList.toggle('visible');
      });

      this.settingsPanel = document.createElement('div');
      this.settingsPanel.className = 'danmaku-settings-panel';
      this.settingsPanel.addEventListener('mousedown', e => e.stopPropagation());
      this.settingsPanel.addEventListener('click', e => e.stopPropagation());

      document.addEventListener('click', (e) => {
        if (this.settingsPanel && !this.settingsPanel.contains(e.target) && e.target !== this.toggleBtn) {
          this.settingsPanel.classList.remove('visible');
        }
      });
    }

    _renderPanelContent() {
      const speedIdx = speedToIndex(this.config.speed);
      const availFonts = getAvailableFonts();
      const fontOptionsHTML = availFonts.map(f =>
        `<option value='${f.value}' ${this.config.fontFamily === f.value ? 'selected' : ''}>${f.label}</option>`
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
        select.addEventListener('change', (e) => {
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
