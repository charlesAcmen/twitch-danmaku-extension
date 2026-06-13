/**
 * config.js
 * 弹幕配置的集中管理
 */
(function (exports) {
  //ES5:strict mode,no easy global variable
  //logging error when trying to change a read-only property
  //no same name in function parameter list
  //this:window->undefined
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    opacity: 0.85,
    fontSizePercent: 100,
    speed: 6.5,
    displayAreaPercent: 100,
    verticalStart: 0.05,
    //fall back:linux:思源黑体,Mac:平方
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    fontWeight: 'normal',
    strokeType: 'outline',
    showSender: true
  };

  const STORAGE_KEY = 'twitch_danmaku_config';

  //all functions are mounted on window.__TD_CONFIG__
  //() tells the js to return the object inside
  ///... is spread operator,which spreads every key/value pair in the new object
  exports.getDefaultConfig = () => ({ ...DEFAULT_CONFIG });

  exports.getConfig = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        //stored will override properties in default ones
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[Twitch Danmaku] Failed to read config from localStorage', e);
    }
    return { ...DEFAULT_CONFIG };
  };

  exports.saveConfig = (newConfig) => {
    try {
      const current = exports.getConfig();
      const updated = { ...current, ...newConfig };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Twitch Danmaku] Failed to save config to localStorage', e);
    }
  };

  exports.resetConfig = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
    } catch (e) {
      console.warn('[Twitch Danmaku] Failed to reset config in localStorage', e);
    }
    return { ...DEFAULT_CONFIG };
  };
//check before using __TD_CONFIG__ in window object
//window is the isolated window in manifest.json not twitch itself
})(window.__TD_CONFIG__ = window.__TD_CONFIG__ || {});
