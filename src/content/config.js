/**
 * config.js
 * 弹幕配置的集中管理
 */
(function (exports) {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    opacity: 0.85,
    fontSizePercent: 100,
    speed: 8,
    displayAreaPercent: 100,
    verticalStart: 0.05
  };

  exports.getConfig = () => ({ ...DEFAULT_CONFIG });
  // 这里未来可以加入 localStorage 的读写逻辑来持久化用户配置

})(window.__TD_CONFIG__ = window.__TD_CONFIG__ || {});
