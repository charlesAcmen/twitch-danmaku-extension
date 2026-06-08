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
        this.settingsPanel.classList.toggle('visible');
      });

      // Settings panel
      this.settingsPanel = document.createElement('div');
      this.settingsPanel.className = 'danmaku-settings-panel';
      this.settingsPanel.innerHTML = `
        <h3>💬 弹幕设置</h3>
        <div class="danmaku-setting-row">
          <label>不透明度</label>
          <input type="range" min="10" max="100" value="${this.config.opacity * 100}" data-setting="opacity">
          <span class="setting-value">${Math.round(this.config.opacity * 100)}%</span>
        </div>
        <div class="danmaku-setting-row">
          <label>字体大小</label>
          <input type="range" min="14" max="40" value="${this.config.fontSize}" data-setting="fontSize">
          <span class="setting-value">${this.config.fontSize}px</span>
        </div>
        <div class="danmaku-setting-row">
          <label>速度</label>
          <input type="range" min="3" max="15" value="${this.config.speed}" data-setting="speed">
          <span class="setting-value">${this.config.speed}s</span>
        </div>
        <div class="danmaku-setting-row">
          <label>轨道数</label>
          <input type="range" min="5" max="30" value="${this.config.maxTracks}" data-setting="maxTracks">
          <span class="setting-value">${this.config.maxTracks}</span>
        </div>
      `;

      this.settingsPanel.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          e.stopPropagation();
          const setting = e.target.dataset.setting;
          let value = parseInt(e.target.value);
          const valueDisplay = e.target.nextElementSibling;

          const changes = {};
          switch (setting) {
            case 'opacity':
              changes.opacity = value / 100;
              valueDisplay.textContent = value + '%';
              break;
            case 'fontSize':
              changes.fontSize = value;
              changes.trackHeight = value + 10;
              valueDisplay.textContent = value + 'px';
              break;
            case 'speed':
              changes.speed = value;
              valueDisplay.textContent = value + 's';
              break;
            case 'maxTracks':
              changes.maxTracks = value;
              valueDisplay.textContent = value;
              break;
          }
          this.onConfigChange(changes);
        });
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('click', e => e.stopPropagation());
      });

      document.addEventListener('click', (e) => {
        if (this.settingsPanel && !this.settingsPanel.contains(e.target) && e.target !== this.toggleBtn) {
          this.settingsPanel.classList.remove('visible');
        }
      });
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
