/// <reference lib="webworker" />
export type {};
declare let self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 1;
const CACHE_NAME = `offline-cache-v${CACHE_VERSION}`;
const ROUTES_TO_CACHE = [
    '/',
    '/park-car',
    '/replace-client-car',
    '/fetch-and-qr.js',
    '/form.css',
];

self.addEventListener('install', (event) => {
    console.log('Service worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ROUTES_TO_CACHE)),
    );
});

self.addEventListener('activate', async (event) => {
    console.log('Service worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                }),
            ),
        ),
    );
    if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
    }
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (ROUTES_TO_CACHE.includes(new URL(event.request.url).pathname)) {
        event.respondWith(handleFetch(event));
    }
});

async function handleFetch(event: FetchEvent) {
    try {
        // Try to get a preloaded response, if available
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
            await checkLogout(preloadResponse);
            if (preloadResponse.ok && !preloadResponse.redirected) {
                await saveResponse(event, preloadResponse);
            }
            return preloadResponse;
        }

        // If no preloaded response, try the network
        const networkResponse = await fetch(event.request);
        await checkLogout(networkResponse);
        if (networkResponse.ok && !networkResponse.redirected) {
            await saveResponse(event, networkResponse);
        }
        return networkResponse;
    } catch (error) {
        console.log('Fetch failed; returning offline page instead.', error);
        const cachedResponse = await caches.match(event.request);
        return cachedResponse || error;
    }
}

async function saveResponse(event: FetchEvent, response: Response) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, response.clone());
}

async function checkLogout(res: Response) {
    if (res.redirected && res.url.endsWith('/login')) {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
    }
}

// self.addEventListener('message', (event) => {
//     if (event.data && event.data.type === 'INVALIDATE_CACHE') {
//         event.waitUntil(
//             caches.delete(CACHE_NAME).then(() => {
//                 console.log('Cache successfully invalidated');
//             })
//         );
//     }
// });
