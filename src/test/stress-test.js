/**
 * stress-test.js
 * 
 * Stress Testing Utility for Twitch Danmaku Engine.
 * Simulates high-frequency WebSocket data bursts to test queue overflow,
 * frame dropping, and collision prevention algorithms.
 * 
 * Usage:
 * Copy and paste this code into the browser Developer Console on a Twitch stream,
 * or inject it via the extension during development.
 */
(function(window) {
  'use strict';

  const StressTest = {
    timer: null,
    
    // Generates a random alphanumeric string
    _generateRandomText(length) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789     ';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    },

    // Generates a random hex color for usernames
    _generateRandomColor() {
      return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    },

    /**
     * Fires a massive burst of messages instantly.
     * Useful for testing queue overflow policy (slicing) and memory limits.
     * 
     * @param {number} count - Number of messages to fire (default: 500)
     */
    fireBurst(count = 500) {
      console.log(`[StressTest] Firing instant burst of ${count} messages...`);
      for (let i = 0; i < count; i++) {
        const textLen = Math.floor(Math.random() * 50) + 5; // Random length between 5 and 55
        const payload = {
          type: 'PRIVMSG',
          username: 'TestBot_' + i,
          color: this._generateRandomColor(),
          message: this._generateRandomText(textLen),
          emotes: [], // Simulating plain text for raw DOM/layout performance
          timestamp: Date.now()
        };

        // Dispatch exactly as the ws-hook would
        const event = new CustomEvent('__twitch_danmaku_msg__', { detail: payload });
        window.dispatchEvent(event);
      }
      console.log(`[StressTest] Burst complete. The queue should now handle the overflow gracefully.`);
    },

    /**
     * Fires a burst of FIXED danmaku messages.
     * Useful for testing the fixed slot stacking and rendering.
     * 
     * @param {number} count - Number of messages to fire (default: 10)
     */
    fireFixedBurst(count = 10) {
      console.log(`[StressTest] Firing instant burst of ${count} FIXED messages...`);
      for (let i = 0; i < count; i++) {
        const payload = {
          type: 'PRIVMSG',
          username: 'BroadcasterBot',
          color: '#FF4500',
          message: 'This is a FIXED message ' + i,
          emotes: [],
          role: 'broadcaster', // This triggers the fixed-top type
          timestamp: Date.now()
        };
        const event = new CustomEvent('__twitch_danmaku_msg__', { detail: payload });
        window.dispatchEvent(event);
      }
      console.log(`[StressTest] Fixed Burst complete.`);
    },

    /**
     * Starts a continuous flood of messages over time.
     * Useful for testing RAF stability and track allocation under sustained load.
     * 
     * @param {number} msgsPerSecond - Target messages per second (default: 100)
     */
    startFlood(msgsPerSecond = 100) {
      if (this.timer) this.stopFlood();
      
      console.log(`[StressTest] Starting sustained flood at ~${msgsPerSecond} msgs/sec...`);
      const intervalMs = 1000 / msgsPerSecond;
      
      let counter = 0;
      this.timer = setInterval(() => {
        counter++;
        const payload = {
          type: 'PRIVMSG',
          username: 'Spammer_' + counter,
          color: this._generateRandomColor(),
          message: this._generateRandomText(15),
          emotes: [],
          timestamp: Date.now()
        };
        const event = new CustomEvent('__twitch_danmaku_msg__', { detail: payload });
        window.dispatchEvent(event);
      }, intervalMs);
    },

    /**
     * Stops the continuous flood.
     */
    stopFlood() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        console.log('[StressTest] Flood stopped.');
      }
    }
  };

  // Expose to window object for easy console access
  window.DanmakuStressTest = StressTest;
  console.log('[StressTest] Utility loaded successfully.');
  console.log('[StressTest] Commands available:');
  console.log('  - window.DanmakuStressTest.fireBurst(500)');
  console.log('  - window.DanmakuStressTest.fireFixedBurst(10)');
  console.log('  - window.DanmakuStressTest.startFlood(100)');
  console.log('  - window.DanmakuStressTest.stopFlood()');

})(window);
