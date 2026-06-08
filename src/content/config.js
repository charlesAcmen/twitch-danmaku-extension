/**
 * config.js
 * 弹幕配置的集中管理
 */
(function (exports) {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    opacity: 0.85,
    fontSize: 22,
    speed: 8,
    maxTracks: 15,
    trackHeight: 32,
    verticalStart: 0.05
  };

  exports.getConfig = () => ({ ...DEFAULT_CONFIG });
  // 这里未来可以加入 localStorage 的读写逻辑来持久化用户配置

})(window.__TD_CONFIG__ = window.__TD_CONFIG__ || {});
