/**
 * quick-font-test.js
 * 
 * 快速字体测试 - 专门测试 emoji 后备功能
 * 直接复制到浏览器 Console 运行
 */

// 发送测试消息的辅助函数
function sendTestMessage(username, message, color = '#00FF00') {
  const event = new CustomEvent('__twitch_danmaku_msg__', { 
    detail: {
      username: username,
      color: color,
      message: message,
      emotes: [],
      timestamp: Date.now()
    }
  });
  window.dispatchEvent(event);
}

// 测试你提到的问题 emoji
console.log('🧪 开始测试问题 emoji: 🫪');
console.log('-----------------------------------');

// Test 1: 单独的 emoji
setTimeout(() => {
  console.log('Test 1: 单独 emoji');
  sendTestMessage('Test1', '🫪', '#FF0000');
}, 100);

// Test 2: 多个问题 emoji
setTimeout(() => {
  console.log('Test 2: 多个新 emoji');
  sendTestMessage('Test2', '🫪🫱🫲🫳🫴🫵🫶', '#FF6600');
}, 600);

// Test 3: 混合内容（最重要）
setTimeout(() => {
  console.log('Test 3: 混合文字和 emoji');
  sendTestMessage('Test3', 'Hello 🫪 测试 😂 World!', '#00FF00');
}, 1100);

// Test 4: 常见 emoji
setTimeout(() => {
  console.log('Test 4: 常见 emoji');
  sendTestMessage('Test4', '😀😂🤣😊😍🥰😘', '#0099FF');
}, 1600);

// Test 5: 复杂 emoji
setTimeout(() => {
  console.log('Test 5: 复杂 ZWJ emoji');
  sendTestMessage('Test5', '👨‍👩‍👧‍👦 👨‍💻 🏳️‍🌈', '#9900FF');
}, 2100);

// Test 6: Kitchen sink
setTimeout(() => {
  console.log('Test 6: 所有类型混合');
  sendTestMessage('Test6', 'Test 🫪 测试 😂 ♠★ ∑≠ 👋🏻 Mix!', '#FF69B4');
}, 2600);

console.log('-----------------------------------');
console.log('✓ 已发送 6 条测试消息');
console.log('');
console.log('📋 检查要点:');
console.log('  1. 🫪 应该正常显示（不是方框 □）');
console.log('  2. 所有 emoji 都应该有颜色');
console.log('  3. 文字和 emoji 混合自然');
console.log('  4. 中文、英文使用设置的字体');
console.log('  5. Emoji 使用系统 emoji 字体');
console.log('');
console.log('💡 提示:');
console.log('  - 切换不同字体测试（右键点击"弹"按钮）');
console.log('  - 所有字体下 emoji 都应该正常显示');
console.log('  - 如果看到方框，说明后备字体没生效');
