const CACHE_NAME = 'jirotter-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/base.css',
    './css/home.css',
    './css/checkin.css',
    './css/guide.css',
    './css/ai-support.css',
    './js/app.js',
    './js/router.js',
    './js/utils/ai-chat-utils.js',
    './js/components/ai-support.js',
    './js/components/auth.js',
    './js/components/checkin.js',
    './js/components/comment.js',
    './js/components/external-link.js',
    './js/components/guide.js',
    './js/components/map.js',
    './js/components/profile.js',
    './js/components/rankings.js',
    './js/components/right-sidebar.js',
    './js/components/search.js',
    './js/components/settings.js',
    './js/components/shop-detail.js',
    './js/components/stamp-rally.js',
    './js/components/timeline.js',
    './js/components/waittime.js',
    './assets/icon.svg',
    './assets/baseicon.png',
    './assets/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    // API requests should go to network
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
