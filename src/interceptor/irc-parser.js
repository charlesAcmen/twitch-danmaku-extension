/**
 * irc-parser.js
 * 纯粹的 Twitch IRC 协议解析器
 * 负责将原始字符串转化为结构化消息对象。
 */
(function (exports) {
  'use strict';

  function parseTags(tagString) {
    const tags = {};
    if (!tagString) return tags;
    const raw = tagString.startsWith('@') ? tagString.slice(1) : tagString;
    const pairs = raw.split(';');
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        tags[pair] = '';
      } else {
        tags[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
      }
    }
    return tags;
  }

  exports.parsePRIVMSG = function(raw) {
    if (typeof raw !== 'string') return null;
    const lines = raw.split('\r\n').filter(line => line.length > 0);
    const results = [];

    for (const line of lines) {
      let pos = 0;
      let tags = {};
      let prefix = '';

      if (line.charAt(0) === '@') {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx === -1) continue;
        tags = parseTags(line.slice(0, spaceIdx));
        pos = spaceIdx + 1;
      }

      if (line.charAt(pos) === ':') {
        const spaceIdx = line.indexOf(' ', pos);
        if (spaceIdx === -1) continue;
        prefix = line.slice(pos + 1, spaceIdx);
        pos = spaceIdx + 1;
      }

      const rest = line.slice(pos);
      const parts = rest.split(' ');
      const command = parts[0];

      if (command !== 'PRIVMSG') continue;

      const msgStart = rest.indexOf(' :');
      if (msgStart === -1) continue;
      const message = rest.slice(msgStart + 2);

      results.push({
        type: 'PRIVMSG',
        tags: tags,
        username: tags['display-name'] || prefix.split('!')[0] || 'Anonymous',
        color: tags['color'] || '',
        channel: parts[1] || '',
        message: message,
        timestamp: Date.now()
      });
    }

    return results.length > 0 ? results : null;
  };

})(window.__TD_IRCPARSER__ = window.__TD_IRCPARSER__ || {});
