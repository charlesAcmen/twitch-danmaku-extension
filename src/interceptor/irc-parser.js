/**
 * irc-parser.js
 * Pure Twitch IRC protocol parser.
 * Converts raw strings to structured message objects.
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
      let message = rest.slice(msgStart + 2);

      // Parse emotes
      // Format: "emote_id:start-end,start-end/emote_id2:start-end"
      let emotes = [];
      if (tags['emotes']) {
        const emoteParts = tags['emotes'].split('/');
        for (const part of emoteParts) {
          const [id, positions] = part.split(':');
          if (!positions) continue;
          const ranges = positions.split(',');
          for (const range of ranges) {
            const [start, end] = range.split('-');
            emotes.push({
              id: id,
              start: parseInt(start, 10),
              end: parseInt(end, 10)
            });
          }
        }
      }

      // Handle CTCP ACTION (/me) messages
      // They are formatted as \x01ACTION message\x01
      let isAction = false;
      if (message.charCodeAt(0) === 0x01 && message.startsWith('\x01ACTION ')) {
        message = message.slice(8, -1); // Strip '\x01ACTION ' (8 chars) and trailing '\x01'
        isAction = true;
        
        // Adjust emote indices because we stripped 8 characters from the start
        for (const emote of emotes) {
          emote.start -= 8;
          emote.end -= 8;
        }
      }

      let role = 'normal';
      if (tags['badges']) {
        if (tags['badges'].includes('broadcaster/')) {
          role = 'broadcaster';
        } else if (tags['badges'].includes('moderator/')) {
          role = 'moderator';
        } else if (tags['badges'].includes('vip/')) {
          role = 'vip';
        } else if (tags['badges'].includes('subscriber/')) {
          role = 'subscriber';
        }
      }

      results.push({
        type: 'PRIVMSG',
        tags: tags,
        username: tags['display-name'] || prefix.split('!')[0] || 'Anonymous',
        color: tags['color'] || '',
        channel: parts[1] || '',
        message: message,
        isAction: isAction,
        emotes: emotes,
        role: role,
        timestamp: Date.now()
      });
    }

    return results.length > 0 ? results : null;
  };

})(window.__TD_IRCPARSER__ = window.__TD_IRCPARSER__ || {});
