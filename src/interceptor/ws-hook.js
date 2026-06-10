/**
 * ws-hook.js
 * 通用的 WebSocket 拦截器（MAIN world）
 * 采用三重 Hook 策略，捕获所有 WebSocket 消息。
 * 高内聚、低耦合：不关心任何具体的业务协议。
 */
(function (exports) {
  'use strict';

  if (window.__TD_WSHOOK_INSTALLED__) return;
  window.__TD_WSHOOK_INSTALLED__ = true;

  const OriginalWebSocket = window.WebSocket;
  const hookedInstances = new WeakSet();
  let wsCounter = 0;
  
  // 回调函数列表
  const messageListeners = [];

  exports.addMessageListener = function(fn) {
    messageListeners.push(fn);
  };

  function notifyListeners(url, data) {
    for (const fn of messageListeners) {
      try {
        fn(url, data);
      } catch (e) {
        console.error('[Twitch Danmaku] WS Listener error:', e);
      }
    }
  }

  function ensureHooked(ws) {
    if (hookedInstances.has(ws)) return;
    hookedInstances.add(ws);

    const id = ++wsCounter;
    const url = ws.url || '(unknown)';

    console.log(`[Twitch Danmaku] Hooked WebSocket #${id}: ${url}`);

    ws.addEventListener('message', function (event) {
      notifyListeners(url, event.data);
    });

    ws.addEventListener('close', function (event) {
      console.log(`[Twitch Danmaku] WebSocket #${id} closed (code=${event.code}).`);
    });
  }

  // Hook 1: Proxy constructor
  window.WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args) {
      const ws = new target(...args);
      try { ensureHooked(ws); } catch (e) {}
      return ws;
    },
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Object.getOwnPropertyDescriptor(target, prop);
    }
  });
  // No need to manually assign prototype, Proxy handles it.
  // Hook 2: onmessage setter
  const origOnmessageDesc = Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');
  if (origOnmessageDesc) {
    Object.defineProperty(OriginalWebSocket.prototype, 'onmessage', {
      set(fn) {
        try { ensureHooked(this); } catch (e) {}
        return origOnmessageDesc.set.call(this, fn);
      },
      get() { return origOnmessageDesc.get.call(this); },
      configurable: true,
      enumerable: true
    });
  }

  // Hook 3: addEventListener
  const origAddEventListener = OriginalWebSocket.prototype.addEventListener;
  OriginalWebSocket.prototype.addEventListener = function (type, ...args) {
    if (type === 'message') {
      try { ensureHooked(this); } catch (e) {}
    }
    return origAddEventListener.call(this, type, ...args);
  };

})(window.__TD_WSHOOK__ = window.__TD_WSHOOK__ || {});
