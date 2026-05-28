// sw.js
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

// 必須要監聽 fetch 事件，PWA 才會被判定為可安裝
self.addEventListener('fetch', (e) => {
  // 目前不做任何快取攔截，直接放行網路請求
});
