# 💬 Twitch Danmaku Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

[English](#english) | [中文](#中文)

---

## English

A high-performance, lightweight Google Chrome extension that overlays Twitch live chat messages directly onto the video player in Bilibili-style danmaku (bullet chat) format.

This extension has been meticulously optimized for **performance stability**, **accurate collision prevention**, and **zero-risk third-party emote integration**.

### ✨ Key Features

#### 🚀 High-Performance DOM Node Pooling
- **Recycled DOM Elements**: Utilizes a central recycling pool (`domPool`) to reuse existing `<span>` nodes instead of constantly creating and destroying elements. This reduces memory allocation and eliminates Garbage Collection (GC) pauses during fast-paced chat storms.
- **Safe Event Handling**: Replaces multiple active event listeners with clean direct property bindings (`onanimationend`) and tracks active timeouts via node-bound IDs (`_timeoutId`), preventing memory leaks and premature node recycling.

#### 🛡️ Zero-Risk Third-Party & Follower Emote Support
- **Passive DOM Scanning**: Monitors the Twitch chat sidebar using a highly-efficient `MutationObserver`. It dynamically scrapes third-party emotes (7TV, BTTV, FrankerFaceZ) and streamer-restricted follower emotes that have already been resolved by the browser.
- **100% Anti-Ban Guarantee**: Never queries external third-party or private Twitch APIs. All data extraction is done client-side on elements already rendered, carrying zero risk of rate limits, IP bans, or account suspension.
- **Tokenized Emote Merging**: Parses incoming raw IRC message strings and blends official Twitch emotes with scanned third-party emotes.

#### 📏 Anti-Collision & Precise Sizing
- **Image Layout Shift Prevention**: Specifies explicit inline style widths and heights on all rendered emote images (`style="width: ${1.2 * ratio}em; height: 1.2em;"`) using their natural aspect ratios.
- **Frame-Perfect Width Estimation**: Forces the browser to reserve space for emotes immediately upon insertion. This ensures the engine's `offsetWidth` measurements are 100% accurate on the first frame, completely solving severe tailgating (追尾) and overlapping issues caused by late-loading images.

#### 🍱 Bilibili-Style Deterministic Track Packing
- **Deterministic First-Safe-Track**: Replaces random track assignment with a Bilibili-style top-down greedy search.
- **Unobstructed View**: Packs messages tightly starting from the top-most track. Under light chat volumes, messages remain neatly aligned at the top of the video player, leaving the center and bottom of the video completely clear for viewing.

#### 🌐 System Font Support with Auto-Detection
- **Local Font Access API**: Automatically detects and lists all text fonts installed on your system
- **Smart Font Filtering**: Excludes symbol and icon fonts to show only readable typefaces
- **Graceful Fallback**: Uses a curated default font list when permission is not granted
- **Live Font Preview**: Each font option displays in its own typeface for easy selection

#### 🔒 Privacy & Security
- **No Data Collection**: Does not collect, store, or transmit any personal information
- **Local Storage Only**: All settings are stored locally in your browser
- **No External Requests**: Operates entirely client-side with zero external API calls
- **Open Source**: Full source code available for audit

### 🏗️ Architecture

The extension is designed around Chrome Extension Manifest V3 best practices, separating concerns across runtime execution environments:

```
┌─────────────────────────────────────────────────────────────────┐
│ Twitch Web Page (MAIN World)                                   │
├─────────────────────────────────────────────────────────────────┤
│  ├── ws-hook.js        → WebSocket Interceptor                 │
│  ├── irc-parser.js     → Twitch IRC Protocol Parser            │
│  └── main.js           → Event Dispatcher                      │
│         │                                                        │
│         ▼ Custom Event Bridge: '__twitch_danmaku_msg__'        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Extension Sandbox (ISOLATED World)                             │
├─────────────────────────────────────────────────────────────────┤
│  ├── main.js           → Main Orchestration & Lifecycle        │
│  ├── emote-scanner.js  → Third-Party Emote Scanner             │
│  ├── danmaku-engine.js → Queue Management & Rendering          │
│  ├── ui.js             → Settings Panel & Controls             │
│  ├── config.js         → Configuration & Storage               │
│  └── twitch-player.js  → Player Element Detection              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- **High Cohesion**: Each module has a single, well-defined responsibility
- **Low Coupling**: Modules communicate through clear interfaces and events
- **Separation of Concerns**: MAIN world (data) and ISOLATED world (rendering) are cleanly separated
- **Testability**: Pure functions and isolated modules enable easy testing

### 📦 Installation

#### From Chrome Web Store (Recommended)
*Coming soon*

#### Manual Installation (Developer Mode)
1. Clone or download this repository
2. Open Google Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top right corner
4. Click **Load unpacked** in the top left corner
5. Select the directory containing the `manifest.json` file
6. Open a Twitch stream page (e.g., `https://www.twitch.tv/xqc`) and enjoy!

### ⚙️ Configuration & Customization

Right-click the toggle button **`弹`** in the bottom-right corner of the video player to access the settings panel:

| Setting | Description |
|---------|-------------|
| **Display Area** | Set vertical constraints (10%, 25%, 50%, 75%, 100%) |
| **Opacity** | Adjust transparency for text and emotes |
| **Font Size** | Scale the danmaku font size (adapts to window size) |
| **Speed** | Control speed stages: 极慢 / 较慢 / 适中 / 较快 / 极快 |
| **Font Family** | Choose from system fonts with live preview |
| **Font Weight** | Toggle bold styling |
| **Sender ID** | Toggle whether sender usernames are displayed |
| **Stroke Type** | Select text shadow styles: 重墨 / 描边 / 45°投影 |

### 🧪 Testing

The extension includes built-in stress testing utilities. Open the Chrome Developer Console (`F12` → Console) on a Twitch page and execute:

#### Simulate Burst Load
```javascript
window.DanmakuStressTest.fireBurst(500); // Queues 500 messages instantly
```

#### Simulate Sustained Traffic
```javascript
window.DanmakuStressTest.startFlood(100); // Sends 100 messages/sec
window.DanmakuStressTest.stopFlood();     // Stops the flood
```

#### Simulate Fixed Announcements
```javascript
window.DanmakuStressTest.fireFixedBurst(10); // Queues 10 pinned messages
```

#### Test Third-Party Emotes
```javascript
window.DanmakuStressTest.testThirdPartyEmote(); // Injects test emotes
```

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### 📄 License

This project is open-source and available under the [MIT License](LICENSE).

### 🔗 Links

- [Privacy Policy](PRIVACY.md)
- [Issue Tracker](https://github.com/yourusername/twitch-danmaku/issues)
- [Source Code](https://github.com/yourusername/twitch-danmaku)

---

## 中文

一款高性能、轻量级的 Google Chrome 扩展，可将 Twitch 直播聊天消息以 Bilibili 风格的弹幕格式直接覆盖到视频播放器上。

本扩展经过精心优化，实现了**性能稳定性**、**精确防碰撞**和**零风险第三方表情集成**。

### ✨ 核心特性

#### 🚀 高性能 DOM 节点池
- **DOM 元素复用**：使用中央回收池 (`domPool`) 复用现有的 `<span>` 节点，而不是不断创建和销毁元素。这减少了内存分配，消除了快节奏聊天风暴期间的垃圾收集 (GC) 暂停。
- **安全的事件处理**：用干净的直接属性绑定 (`onanimationend`) 替换多个活动事件监听器，并通过节点绑定的 ID (`_timeoutId`) 跟踪活动超时，防止内存泄漏和节点过早回收。

#### 🛡️ 零风险第三方和关注者表情支持
- **被动 DOM 扫描**：使用高效的 `MutationObserver` 监控 Twitch 聊天侧边栏。它动态抓取浏览器已解析的第三方表情（7TV、BTTV、FrankerFaceZ）和主播限制的关注者表情。
- **100% 防封号保证**：永不查询外部第三方或私有 Twitch API。所有数据提取都在客户端对已渲染的元素进行，零风险的速率限制、IP 封禁或账户暂停。
- **词法表情合并**：解析传入的原始 IRC 消息字符串，并将官方 Twitch 表情与扫描的第三方表情混合。

#### 📏 防碰撞和精确尺寸
- **图像布局偏移预防**：使用自然宽高比在所有渲染的表情图像上指定显式内联样式宽度和高度 (`style="width: ${1.2 * ratio}em; height: 1.2em;"`)。
- **逐帧完美宽度估算**：强制浏览器在插入时立即为表情保留空间。这确保引擎的 `offsetWidth` 测量在第一帧就 100% 准确，完全解决了延迟加载图像导致的严重追尾和重叠问题。

#### 🍱 Bilibili 风格确定性轨道打包
- **确定性首个安全轨道**：用 Bilibili 风格的自顶向下贪心搜索替换随机轨道分配。
- **无遮挡视图**：从最顶部的轨道开始紧密打包消息。在轻量聊天量下，消息整齐地对齐在视频播放器顶部，完全清空视频的中部和底部以供观看。

#### 🌐 系统字体支持与自动检测
- **本地字体访问 API**：自动检测并列出系统上安装的所有文本字体
- **智能字体过滤**：排除符号和图标字体，仅显示可读字体
- **优雅降级**：当未授予权限时使用精选的默认字体列表
- **实时字体预览**：每个字体选项以其自身字体显示，便于选择

#### 🔒 隐私与安全
- **无数据收集**：不收集、存储或传输任何个人信息
- **仅本地存储**：所有设置本地存储在您的浏览器中
- **无外部请求**：完全在客户端运行，零外部 API 调用
- **开源**：完整源代码可供审计

### 🏗️ 架构设计

扩展围绕 Chrome Extension Manifest V3 最佳实践设计，在运行时执行环境中分离关注点：

```
┌─────────────────────────────────────────────────────────────────┐
│ Twitch 网页 (MAIN World)                                       │
├─────────────────────────────────────────────────────────────────┤
│  ├── ws-hook.js        → WebSocket 拦截器                      │
│  ├── irc-parser.js     → Twitch IRC 协议解析器                 │
│  └── main.js           → 事件分发器                            │
│         │                                                        │
│         ▼ 自定义事件桥接: '__twitch_danmaku_msg__'             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 扩展沙箱 (ISOLATED World)                                      │
├─────────────────────────────────────────────────────────────────┤
│  ├── main.js           → 主编排和生命周期                      │
│  ├── emote-scanner.js  → 第三方表情扫描器                      │
│  ├── danmaku-engine.js → 队列管理和渲染                        │
│  ├── ui.js             → 设置面板和控件                        │
│  ├── config.js         → 配置和存储                            │
│  └── twitch-player.js  → 播放器元素检测                        │
└─────────────────────────────────────────────────────────────────┘
```

**核心设计原则：**
- **高内聚**：每个模块都有单一、明确定义的职责
- **低耦合**：模块通过清晰的接口和事件通信
- **关注点分离**：MAIN world（数据）和 ISOLATED world（渲染）干净分离
- **可测试性**：纯函数和隔离模块使测试变得容易

### 📦 安装

#### 从 Chrome 网上应用店安装（推荐）
*即将推出*

#### 手动安装（开发者模式）
1. 克隆或下载此仓库
2. 打开 Google Chrome 并导航到 `chrome://extensions/`
3. 在右上角启用**开发者模式**
4. 点击左上角的**加载已解压的扩展程序**
5. 选择包含 `manifest.json` 文件的目录
6. 打开 Twitch 直播页面（例如 `https://www.twitch.tv/xqc`）并享受！

### ⚙️ 配置和自定义

右键单击视频播放器右下角的切换按钮 **`弹`** 以访问设置面板：

| 设置 | 描述 |
|------|------|
| **显示区域** | 设置垂直约束（10%、25%、50%、75%、100%）|
| **不透明度** | 调整文本和表情的透明度 |
| **弹幕字号** | 缩放弹幕字体大小（自动适应窗口大小）|
| **弹幕速度** | 控制速度阶段：极慢 / 较慢 / 适中 / 较快 / 极快 |
| **弹幕字体** | 从系统字体中选择，带实时预览 |
| **粗体** | 切换粗体样式 |
| **发送者 ID** | 切换是否显示发送者用户名 |
| **描边类型** | 选择文字阴影样式：重墨 / 描边 / 45°投影 |

### 🧪 测试

扩展包含内置的压力测试实用程序。在 Twitch 页面上打开 Chrome 开发者控制台（`F12` → 控制台）并执行：

#### 模拟突发负载
```javascript
window.DanmakuStressTest.fireBurst(500); // 立即排队 500 条消息
```

#### 模拟持续流量
```javascript
window.DanmakuStressTest.startFlood(100); // 每秒发送 100 条消息
window.DanmakuStressTest.stopFlood();     // 停止洪流
```

#### 模拟固定公告
```javascript
window.DanmakuStressTest.fireFixedBurst(10); // 排队 10 条置顶消息
```

#### 测试第三方表情
```javascript
window.DanmakuStressTest.testThirdPartyEmote(); // 注入测试表情
```

### 🤝 贡献

欢迎贡献！请随时提交 Pull Request。对于重大更改，请先打开一个 issue 讨论您想要更改的内容。

### 📄 许可证

本项目是开源的，根据 [MIT 许可证](LICENSE) 提供。

### 🔗 链接

- [隐私政策](PRIVACY.md)
- [问题追踪器](https://github.com/yourusername/twitch-danmaku/issues)
- [源代码](https://github.com/yourusername/twitch-danmaku)
