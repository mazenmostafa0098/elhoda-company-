const CACHE_NAME = "closing-app-cache-v2.1";
const OFFLINE_URL = "/offline.html"; // صفحة أوفللاين مخصصة
const CACHE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icon-192.png.png",
  "/fonts/tajawal.woff2", // إضافة موارد إضافية
  "/images/logo.svg",
  OFFLINE_URL,
];

// ========== تثبيت الخادم العامل ==========
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("جارٍ تخزين الموارد الأساسية");
        return cache.addAll(CACHE_ASSETS);
      })
      .catch((error) => {
        console.error("فشل التثبيت:", error);
      })
  );
});

// ========== تفعيل الخادم العامل ==========
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("جارٍ حذف الذاكرة المؤقتة القديمة:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// ========== إدارة الطلبات ==========
self.addEventListener("fetch", (event) => {
  // استثناء الطلبات الخارجية وطلبات الصفحات
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      networkFirstStrategy(event.request)
        .catch(() => cacheFirstStrategy(event.request))
        .catch(() => showOfflinePage())
    );
  }
});

// ========== استراتيجيات التخزين ==========
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || Promise.reject("لا يوجد اتصال بالشبكة");
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  return cachedResponse || fetch(request);
}

async function showOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const offlinePage = await cache.match(OFFLINE_URL);
  return offlinePage || Response.error();
}

// ========== تحديث الخلفية ==========
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
// في script.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    });
  });
  
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
