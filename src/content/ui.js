/**
 * ui.js
 * 负责创建、管理弹幕的控制 UI，与配置模块和引擎模块解耦。
 */
(function (exports) {
  'use strict';

  class DanmakuUI {
    constructor(config, onConfigChange, onToggle) {
      this.config = config;
      this.onConfigChange = onConfigChange;
      this.onToggle = onToggle;

      this.toggleBtn = null;
      this.settingsPanel = null;

      this._createControls();
    }

    _createControls() {
      // Toggle button
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

      // Settings panel
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
      this.settingsPanel.innerHTML = `
        <h3>💬 弹幕设置</h3>
        <div class="danmaku-setting-row">
          <label>显示区域</label>
          <input type="range" min="0" max="4" step="1" value="${[10, 25, 50, 75, 100].indexOf(this.config.displayAreaPercent)}" data-setting="displayAreaPercent">
          <span class="setting-value">${this.config.displayAreaPercent}%</span>
        </div>
        <div class="danmaku-setting-row">
          <label>不透明度</label>
          <input type="range" min="10" max="100" value="${this.config.opacity * 100}" data-setting="opacity">
          <span class="setting-value">${Math.round(this.config.opacity * 100)}%</span>
        </div>
        <div class="danmaku-setting-row">
          <label>弹幕字号</label>
          <input type="range" min="50" max="170" step="1" value="${this.config.fontSizePercent}" data-setting="fontSizePercent">
          <span class="setting-value">${this.config.fontSizePercent}%</span>
        </div>
        
        <div class="danmaku-setting-row">
          <label>弹幕速度</label>
          <div class="danmaku-btn-group" data-setting="speed">
            <button class="danmaku-btn ${this.config.speed === 12 ? 'active' : ''}" data-value="12">极慢</button>
            <button class="danmaku-btn ${this.config.speed === 10 ? 'active' : ''}" data-value="10">较慢</button>
            <button class="danmaku-btn ${this.config.speed === 8 ? 'active' : ''}" data-value="8">适中</button>
            <button class="danmaku-btn ${this.config.speed === 6 ? 'active' : ''}" data-value="6">较快</button>
            <button class="danmaku-btn ${this.config.speed === 4 ? 'active' : ''}" data-value="4">极快</button>
          </div>
        </div>

        <div class="danmaku-setting-row">
          <label>弹幕字体</label>
          <div class="danmaku-font-controls">
            <select data-setting="fontFamily" class="danmaku-select">
              <option value='"Microsoft YaHei", "微软雅黑", sans-serif' ${this.config.fontFamily.includes('YaHei') || this.config.fontFamily.includes('微软雅黑') ? 'selected' : ''}>微软雅黑</option>
              <option value='"SimHei", "黑体", sans-serif' ${this.config.fontFamily.includes('SimHei') ? 'selected' : ''}>黑体</option>
              <option value='"KaiTi", "楷体", serif' ${this.config.fontFamily.includes('KaiTi') ? 'selected' : ''}>楷体</option>
              <option value='"SimSun", "宋体", serif' ${this.config.fontFamily.includes('SimSun') ? 'selected' : ''}>宋体</option>
              <option value='"PingFang SC", sans-serif' ${this.config.fontFamily.includes('PingFang') ? 'selected' : ''}>PingFang SC</option>
              <option value='"Inter", sans-serif' ${this.config.fontFamily.includes('Inter') ? 'selected' : ''}>Inter</option>
            </select>
            <label class="danmaku-checkbox-label">
              <input type="checkbox" data-setting="fontWeight" ${this.config.fontWeight === 'bold' ? 'checked' : ''}> 粗体
            </label>
          </div>
        </div>

        <div class="danmaku-setting-row">
          <label>描边类型</label>
          <div class="danmaku-btn-group" data-setting="strokeType">
            <button class="danmaku-btn ${this.config.strokeType === 'heavy' ? 'active' : ''}" data-value="heavy">重墨</button>
            <button class="danmaku-btn ${this.config.strokeType === 'outline' ? 'active' : ''}" data-value="outline">描边</button>
            <button class="danmaku-btn ${this.config.strokeType === 'shadow' ? 'active' : ''}" data-value="shadow">45°投影</button>
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
      // Range inputs
      this.settingsPanel.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          const setting = e.target.dataset.setting;
          let value = parseInt(e.target.value);
          const valueDisplay = e.target.nextElementSibling;

          const changes = {};
          if (setting === 'displayAreaPercent') {
            const areas = [10, 25, 50, 75, 100];
            changes[setting] = areas[value];
            valueDisplay.textContent = areas[value] + '%';
          } else if (setting === 'opacity') {
            changes[setting] = value / 100;
            valueDisplay.textContent = value + '%';
          } else {
            changes[setting] = value;
            valueDisplay.textContent = value + '%';
          }
          this._dispatchChange(changes);
        });
      });

      // Button groups
      this.settingsPanel.querySelectorAll('.danmaku-btn-group').forEach(group => {
        const setting = group.dataset.setting;
        group.querySelectorAll('.danmaku-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            group.querySelectorAll('.danmaku-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            let value = btn.dataset.value;
            if (setting === 'speed') value = parseInt(value);
            this._dispatchChange({ [setting]: value });
          });
        });
      });

      // Select
      const select = this.settingsPanel.querySelector('select[data-setting="fontFamily"]');
      if (select) {
        select.addEventListener('change', (e) => {
          this._dispatchChange({ fontFamily: e.target.value });
        });
      }

      // Checkbox
      const checkbox = this.settingsPanel.querySelector('input[type="checkbox"][data-setting="fontWeight"]');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          this._dispatchChange({ fontWeight: e.target.checked ? 'bold' : 'normal' });
        });
      }

      // Reset Button
      const resetBtn = this.settingsPanel.querySelector('#danmaku-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (confirm('确定要恢复弹幕的默认设置吗？')) {
            // Get default config from global
            if (window.__TD_CONFIG__ && window.__TD_CONFIG__.getConfig) {
              // We just remove the item from localstorage and reload
              localStorage.removeItem('twitch_danmaku_config');
              location.reload();
            }
          }
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
