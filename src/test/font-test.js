/**
 * font-test.js
 * 
 * Font and Special Character Testing Utility for Twitch Danmaku Engine.
 * Tests various fonts, emoji, and special Unicode characters to ensure proper rendering.
 * 
 * Usage:
 * 1. Load the extension on a Twitch stream page
 * 2. Open Developer Console (F12)
 * 3. Run commands like: window.DanmakuFontTest.testAllFonts()
 */
(function(window) {
  'use strict';

  const FontTest = {
    
    /**
     * Test data containing various special characters and emoji
     */
    testMessages: {
      // Basic Latin
      basic: 'Hello World! Testing 123',
      
      // Chinese characters
      chinese: '你好世界 测试弹幕 微软雅黑',
      
      // Japanese
      japanese: 'こんにちは世界 テスト',
      
      // Common emoji (should work in most fonts with fallback)
      commonEmoji: '😀😂🤣😊😍🥰😘 emoji test',
      
      // Newer emoji (Unicode 13.0+, like the ones you mentioned)
      newEmoji: '🫪🫱🫲🫳🫴🫵🫶 new emoji',
      
      // Mixed content (the most realistic scenario)
      mixed: 'Hello 🫪 测试 😂 World!',
      
      // Symbol characters
      symbols: '♠♣♥♦★☆♪♫✓✗←→↑↓',
      
      // Mathematical symbols
      math: '∑∏∫≠≈±×÷√∞',
      
      // Box drawing characters
      boxes: '─│┌┐└┘├┤┬┴┼',
      
      // Emoji with skin tones
      skinTones: '👋👋🏻👋🏼👋🏽👋🏾👋🏿',
      
      // ZWJ sequences (complex emoji)
      complexEmoji: '👨‍👩‍👧‍👦 👨‍💻 🏳️‍🌈',
      
      // All types combined
      kitchen: 'Test 🫪 测试 😂 ♠★ ∑≠ 👋🏻 Mix!'
    },

    /**
     * Available test fonts
     */
    testFonts: [
      { name: 'Arial', value: 'Arial, sans-serif' },
      { name: 'Times New Roman', value: '"Times New Roman", serif' },
      { name: 'Georgia', value: 'Georgia, serif' },
      { name: 'Courier New', value: '"Courier New", monospace' },
      { name: 'Verdana', value: 'Verdana, sans-serif' },
      { name: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
      { name: 'SimSun', value: 'SimSun, serif' }
    ],

    _dispatchMessage(username, message, color = '#00FF00') {
      const payload = {
        type: 'PRIVMSG',
        username: username,
        color: color,
        message: message,
        emotes: [],
        timestamp: Date.now()
      };
      const event = new CustomEvent('__twitch_danmaku_msg__', { detail: payload });
      window.dispatchEvent(event);
    },

    /**
     * Test a specific font with all character types
     * @param {string} fontName - Display name of the font
     * @param {string} fontValue - CSS font-family value
     */
    testFont(fontName, fontValue) {
      console.log(`[FontTest] Testing font: ${fontName}`);
      
      // Update danmaku config to use this font
      if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
        window.__TD_CONFIG__.saveConfig({ fontFamily: fontValue });
      }
      
      // Wait a bit for config to apply
      setTimeout(() => {
        console.log(`[FontTest] Sending test messages with font: ${fontName}`);
        
        // Send each test message with a delay
        const messages = Object.entries(this.testMessages);
        messages.forEach(([type, message], index) => {
          setTimeout(() => {
            this._dispatchMessage(
              `${fontName}_${type}`,
              message,
              this._generateRandomColor()
            );
          }, index * 300); // 300ms delay between each message
        });
        
        console.log(`[FontTest] ✓ Sent ${messages.length} test messages with font: ${fontName}`);
      }, 100);
    },

    /**
     * Test all available fonts sequentially
     */
    testAllFonts() {
      console.log('[FontTest] Starting comprehensive font test...');
      console.log(`[FontTest] Will test ${this.testFonts.length} fonts`);
      
      this.testFonts.forEach((font, index) => {
        setTimeout(() => {
          this.testFont(font.name, font.value);
        }, index * (Object.keys(this.testMessages).length * 300 + 1000));
      });
      
      const totalTime = this.testFonts.length * (Object.keys(this.testMessages).length * 300 + 1000) / 1000;
      console.log(`[FontTest] Test will complete in approximately ${totalTime.toFixed(1)} seconds`);
    },

    /**
     * Test only special characters and emoji (quick test)
     */
    testSpecialChars() {
      console.log('[FontTest] Testing special characters and emoji...');
      
      const specialTests = ['commonEmoji', 'newEmoji', 'symbols', 'complexEmoji', 'kitchen'];
      
      specialTests.forEach((type, index) => {
        setTimeout(() => {
          this._dispatchMessage(
            `Special_${type}`,
            this.testMessages[type],
            this._generateRandomColor()
          );
        }, index * 300);
      });
      
      console.log('[FontTest] ✓ Sent special character test messages');
    },

    /**
     * Test the specific problematic emoji you mentioned: 🫪
     */
    testProblematicEmoji() {
      console.log('[FontTest] Testing problematic emoji: 🫪');
      
      const tests = [
        'Just the emoji: 🫪',
        'Multiple: 🫪🫪🫪',
        'With text: Hello 🫪 World',
        'With Chinese: 你好 🫪 测试',
        'Mixed: 🫪 Test 😂 测试 🫪'
      ];
      
      tests.forEach((message, index) => {
        setTimeout(() => {
          this._dispatchMessage(
            'EmojiTest_' + index,
            message,
            '#FF69B4'
          );
        }, index * 500);
      });
      
      console.log('[FontTest] ✓ Sent problematic emoji test messages');
    },

    /**
     * Compare font fallback behavior
     * Sends the same message with different fonts
     */
    testFallbackComparison() {
      console.log('[FontTest] Testing font fallback comparison...');
      
      const testMessage = '🫪 Test 测试 😂 ♠★ Mix!';
      
      this.testFonts.forEach((font, index) => {
        setTimeout(() => {
          // Temporarily change font
          if (window.__TD_CONFIG__ && window.__TD_CONFIG__.saveConfig) {
            window.__TD_CONFIG__.saveConfig({ fontFamily: font.value });
          }
          
          setTimeout(() => {
            this._dispatchMessage(
              font.name,
              testMessage,
              this._generateRandomColor()
            );
          }, 50);
        }, index * 600);
      });
      
      console.log('[FontTest] ✓ Sent fallback comparison test');
    },

    /**
     * Test emoji rendering with current font
     */
    testCurrentFont() {
      console.log('[FontTest] Testing with current font settings...');
      
      const config = window.__TD_CONFIG__ ? window.__TD_CONFIG__.getConfig() : {};
      const currentFont = config.fontFamily || 'Default';
      
      console.log(`[FontTest] Current font: ${currentFont}`);
      
      // Send all test messages with current font
      Object.entries(this.testMessages).forEach(([type, message], index) => {
        setTimeout(() => {
          this._dispatchMessage(
            `Current_${type}`,
            message,
            this._generateRandomColor()
          );
        }, index * 300);
      });
      
      console.log('[FontTest] ✓ Sent test messages with current font');
    },

    /**
     * Test with emotes and special characters mixed
     */
    testWithEmotes() {
      console.log('[FontTest] Testing special chars with Twitch emotes...');
      
      // First populate emote cache
      if (!window.__TD_EMOTE_CACHE__) {
        window.__TD_EMOTE_CACHE__ = {};
      }
      window.__TD_EMOTE_CACHE__['Kappa'] = {
        src: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0',
        ratio: 1.0
      };
      
      const mixedMessages = [
        'Kappa 🫪 mixed test',
        '🫪 Kappa 😂 Kappa 🫪',
        'Hello Kappa 测试 🫪 World'
      ];
      
      mixedMessages.forEach((message, index) => {
        setTimeout(() => {
          this._dispatchMessage(
            'Mixed_' + index,
            message,
            '#9147FF'
          );
        }, index * 400);
      });
      
      console.log('[FontTest] ✓ Sent mixed emote and special char tests');
    },

    _generateRandomColor() {
      return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    },

    /**
     * Display help information
     */
    help() {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║           Danmaku Font Test Utility - Commands            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Quick Tests:');
      console.log('  DanmakuFontTest.testCurrentFont()      - Test current font');
      console.log('  DanmakuFontTest.testProblematicEmoji() - Test 🫪 and similar');
      console.log('  DanmakuFontTest.testSpecialChars()     - Test emoji & symbols');
      console.log('');
      console.log('Comprehensive Tests:');
      console.log('  DanmakuFontTest.testAllFonts()         - Test all fonts (slow)');
      console.log('  DanmakuFontTest.testFallbackComparison() - Compare fonts');
      console.log('');
      console.log('Specific Tests:');
      console.log('  DanmakuFontTest.testFont("Arial", "Arial, sans-serif")');
      console.log('  DanmakuFontTest.testWithEmotes()       - Mixed emotes & chars');
      console.log('');
      console.log('Test Messages Available:');
      Object.keys(this.testMessages).forEach(key => {
        console.log(`  - ${key}: ${this.testMessages[key].substring(0, 40)}...`);
      });
      console.log('');
    }
  };

  // Expose to window object for easy console access
  window.DanmakuFontTest = FontTest;
  console.log('[FontTest] Font testing utility loaded successfully.');
  console.log('[FontTest] Type: DanmakuFontTest.help() for available commands');

})(window);
