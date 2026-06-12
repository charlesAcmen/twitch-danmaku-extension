# 💬 Twitch Danmaku Extension

A high-performance, lightweight Google Chrome extension that overlays Twitch live chat messages directly onto the Twitch video player in Bilibili-style danmaku (bullet chat) format.

This extension has been meticulously optimized for **performance stability**, **accurate collision prevention**, and **zero-risk third-party emote integration**.

---

## ✨ Key Features

### 🚀 High-Performance DOM Node Pooling
*   **Recycled DOM Elements**: Utilizes a central recycling pool (`domPool`) to reuse existing `<span>` nodes instead of constantly creating and destroying elements. This reduces memory allocation and eliminates Garbage Collection (GC) pauses during fast-paced chat storms.
*   **Safe Event Handling**: Replaces multiple active event listeners with clean direct property bindings (`onanimationend`) and tracks active timeouts via node-bound IDs (`_timeoutId`), preventing memory leaks and premature node recycling.

### 🛡️ Zero-Risk Third-Party & Follower Emote Support
*   **Passive DOM Scanning**: Monitors the Twitch chat sidebar using a highly-efficient `MutationObserver`. It dynamically scrapes third-party emotes (7TV, BTTV, FrankerFaceZ) and streamer-restricted follower emotes that have already been resolved by the browser.
*   **100% Anti-Ban Guarantee**: Never queries external third-party or private Twitch APIs. All data extraction is done client-side on elements already rendered, carrying zero risk of rate limits, IP bans, or account suspension.
*   **Tokenized Emote Merging**: Parses incoming raw IRC message strings and blends official Twitch emotes with scanned third-party emotes.

### 📏 Anti-Collision & Precise Sizing
*   **Image Layout Shift Prevention**: Specifies explicit inline style widths and heights on all rendered emote images (`style="width: ${1.2 * ratio}em; height: 1.2em;"`) using their natural aspect ratios.
*   **Frame-Perfect Width Estimation**: Forces the browser to reserve space for emotes immediately upon insertion. This ensures the engine's `offsetWidth` measurements are 100% accurate on the first frame, completely solving severe tailgating (追尾) and overlapping issues caused by late-loading images.

### 🍱 Bilibili-Style Deterministic Track Packing
*   **Deterministic First-Safe-Track**: Replaces random track assignment with a Bilibili-style top-down greedy search.
*   **Unobstructed View**: Packs messages tightly starting from the top-most track. Under light chat volumes, messages remain neatly aligned at the top of the video player, leaving the center and bottom of the video completely clear for viewing.

---

## 🏗️ Architecture

The extension is designed around Chrome Extension Manifest V3 best practices, separating concerns across runtime execution environments:

```
[ Twitch Web Page (MAIN World) ]
  ├── ws-hook.js (WebSocket Interceptor)
  ├── irc-parser.js (Twitch IRC Parser)
  └── main.js (Dispatches custom events via window object)
         │
         ▼ (Custom Event Bridge: '__twitch_danmaku_msg__')
         │
[ Extension Sandbox (ISOLATED World) ]
  ├── main.js (Controls DOM scanner & mounts UI)
  ├── danmaku-engine.js (Manages queues, tracks, pooling & layout)
  ├── ui.js (Creates & binds Settings panel UI)
  ├── config.js (Controls localStorage state)
  └── twitch-player.js (Locates active video element wrapper)
```

---

## 📦 Installation

To load and use this extension in developer mode:

1.  Clone or download this repository.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked** in the top left corner.
5.  Select the directory containing the `manifest.json` file.
6.  Open a Twitch stream page (e.g., `https://www.twitch.tv/xqc`) and watch the danmaku overlay!

---

## ⚙️ Configuration & Customization

Right-click the toggle button **`弹`** in the bottom-right corner of the video player to access the settings panel:
*   **Display Area**: Set vertical constraints (10%, 25%, 50%, 75%, 100%) to lock danmaku to parts of the screen.
*   **Opacity**: Adjust transparency for text and emotes.
*   **Font Size**: Scale the danmaku font size (automatically adapts to browser window size).
*   **Speed**: Control speed stages (极慢 / 较慢 / 适中 / 较快 / 极快).
*   **Font Family & Weight**: Customize typeface and choose bold styling.
*   **Sender ID**: Toggle whether sender usernames are prefix-rendered.
*   **Stroke Type**: Select text shadow styles (重墨 / 描边 / 45°投影) for maximum visibility on all video backgrounds.

---

## 🧪 Developer Testing

The extension comes with a built-in stress testing utility located in `src/test/stress-test.js` to simulate heavy loads, fixed announcements, and third-party emotes. 

To run tests, open the Chrome Developer Console (`F12` -> Console) on a Twitch page and execute:

*   **Simulate Burst Load**:
    ```javascript
    window.DanmakuStressTest.fireBurst(500); // Instantly queues 500 messages to test overflow drops
    ```
*   **Simulate Sustained Traffic**:
    ```javascript
    window.DanmakuStressTest.startFlood(100); // Sends 100 messages/sec continuously to test RAF frame stability
    window.DanmakuStressTest.stopFlood();      // Stops the continuous flood
    ```
*   **Simulate Fixed Announcements**:
    ```javascript
    window.DanmakuStressTest.fireFixedBurst(10); // Queues 10 pinned messages in the top slots
    ```
*   **Simulate Follower & Third-Party Emotes**:
    ```javascript
    window.DanmakuStressTest.testThirdPartyEmote(); // Injects the 'xqcL' follower emote to verify layout sizing
    ```

---

## 📄 License
This project is open-source and available under the MIT License.
