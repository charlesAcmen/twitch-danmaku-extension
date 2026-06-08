/**
 * main.js (Interceptor)
 * 将 WS Hook 和 IRC Parser 结合，作为数据生产者分发事件。
 */
(function () {
  'use strict';

  const hook = window.__TD_WSHOOK__;
  const parser = window.__TD_IRCPARSER__;

  if (!hook || !parser) {
    console.error('[Twitch Danmaku] Missing interceptor dependencies.');
    return;
  }

  function dispatchDanmaku(msgData) {
    window.dispatchEvent(new CustomEvent('__twitch_danmaku_msg__', {
      detail: msgData
    }));
  }

  hook.addMessageListener((url, data) => {
    if (typeof data !== 'string') return;
    if (!data.includes('PRIVMSG')) return;

    const messages = parser.parsePRIVMSG(data);
    if (messages) {
      for (const msg of messages) {
        dispatchDanmaku(msg);
      }
    }
  });

  console.log('[Twitch Danmaku] Interceptor main ready.');
})();
