/**
 * main.js (Content)
 * Main orchestration module that integrates all extension components.
 * 
 * Responsibilities:
 * - Mount the danmaku overlay container to the Twitch video player
 * - Initialize the danmaku engine and UI controls
 * - Listen for IRC message events and forward them to the engine
 * - Handle SPA navigation and remounting
 * - Coordinate emote scanner initialization
 * 
 * 主编排模块，集成所有扩展组件。
 * 
 * 职责：
 * - 将弹幕覆盖容器挂载到 Twitch 视频播放器
 * - 初始化弹幕引擎和 UI 控件
 * - 监听 IRC 消息事件并转发给引擎
 * - 处理 SPA 导航和重新挂载
 * - 协调表情扫描器初始化
 */
(function () {
  'use strict';

  const { getConfig, resetConfig } = window.__TD_CONFIG__;
  const { DanmakuEngine } = window.__TD_ENGINE__;
  const { DanmakuUI } = window.__TD_UI__;
  const { findPlayer } = window.__TD_PLAYER__;
  const { initEmoteScanner, cleanupEmoteScanner } = window.__TD_EMOTE_SCANNER__;

  let config = getConfig();
  let engine = null;
  let ui = null;
  let playerEl = null;
  let container = null;
  let mountRetryCount = 0;
  const MAX_MOUNT_RETRIES = 60;

  /**
   * Mount the danmaku overlay to the Twitch video player.
   * Creates the container, initializes engine and UI components.
   * 
   * 将弹幕覆盖层挂载到 Twitch 视频播放器。
   * 创建容器，初始化引擎和 UI 组件。
   * 
   * @returns {boolean} - True if successfully mounted, false otherwise
   */
  function mount() {
    const player = findPlayer();
    if (!player) return false;

    // Skip if already mounted to the same player
    // 如果已挂载到同一播放器则跳过
    if (playerEl === player && container && container.parentElement === player) {
      return true;
    }

    playerEl = player;
    const pos = window.getComputedStyle(player).position;
    if (pos === 'static') {
      player.style.position = 'relative';
    }

    // Create overlay container
    // 创建覆盖层容器
    container = document.createElement('div');
    container.className = 'danmaku-container';
    container.id = 'twitch-danmaku-overlay';
    
    player.appendChild(container);

    // Initialize danmaku engine
    // 初始化弹幕引擎
    engine = new DanmakuEngine(container, config);
    
    // Initialize UI controls with callbacks
    // 初始化 UI 控件和回调
    ui = new DanmakuUI(
      config, 
      // onConfigChange: save and apply config changes
      // onConfigChange: 保存并应用配置更改
      (changes) => {
        config = { ...config, ...changes };
        if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
          window.__TD_CONFIG__.saveConfig(config);
        }
        engine.updateConfig(config);
      },
      // onToggle: enable/disable danmaku
      // onToggle: 启用/禁用弹幕
      (enabled) => {
        config.enabled = enabled;
        if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
          window.__TD_CONFIG__.saveConfig(config);
        }
        engine.updateConfig({ enabled });
        if (enabled) {
          container.style.display = '';
        } else {
          container.style.display = 'none';
          engine.clear();
        }
      },
      // onReset: restore default settings
      // onReset: 恢复默认设置
      () => {
        if (!resetConfig) return null;
        config = resetConfig();
        engine.updateConfig(config);
        if (config.enabled) {
          container.style.display = '';
        } else {
          container.style.display = 'none';
        }
        engine.clear();
        return config;
      }
    );
    
    ui.mount(player);

    console.log('[Twitch Danmaku] Mounted to player.');
    return true;
  }

  /**
   * Retry mounting with exponential backoff.
   * Called when initial mount fails due to player not being ready.
   * 
   * 使用指数退避重试挂载。
   * 当播放器未准备好导致初始挂载失败时调用。
   * 
   * @returns {boolean} - True if mounted successfully
   */
  function tryMount() {
    if (mount()) {
      initEmoteScanner();
      return true;
    }
    mountRetryCount++;
    if (mountRetryCount < MAX_MOUNT_RETRIES) {
      setTimeout(tryMount, 500);
    } else {
      console.warn('[Twitch Danmaku] Failed to mount after maximum retries.');
    }
    return false;
  }

  /**
   * Listen for IRC message events from the interceptor (MAIN world).
   * Forward parsed messages to the danmaku engine.
   * 
   * 监听来自拦截器（MAIN world）的 IRC 消息事件。
   * 将解析的消息转发给弹幕引擎。
   */
  window.addEventListener('__twitch_danmaku_msg__', function (event) {
    const data = event.detail;
    if (!data || !data.message || !engine) return;

    // Remount if container was detached
    // 如果容器已分离则重新挂载
    if (!container || !container.parentElement) {
      if (!mount()) return;
    }

    engine.add(data.username, data.message, data.color, data.emotes, data.role);
  });

  // Initialize on page load
  // 页面加载时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryMount);
  } else {
    tryMount();
  }

  /**
   * Handle SPA navigation (Twitch uses client-side routing).
   * Detect URL changes and remount the extension.
   * 
   * 处理 SPA 导航（Twitch 使用客户端路由）。
   * 检测 URL 更改并重新挂载扩展。
   */
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      mountRetryCount = 0;
      
      // Clean up previous instance
      // 清理先前的实例
      cleanupEmoteScanner();
      if (container) container.remove();
      if (ui && ui.toggleBtn) ui.toggleBtn.remove();
      if (ui && ui.settingsPanel) ui.settingsPanel.remove();
      container = null;
      playerEl = null;
      
      // Remount after navigation settles
      // 导航稳定后重新挂载
      setTimeout(tryMount, 1000);
    }
  });
  urlObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  console.log('[Twitch Danmaku] Content main ready.');
})();
