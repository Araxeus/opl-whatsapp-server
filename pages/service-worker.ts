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

self.addEventListener('activate', (event) => {
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
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (ROUTES_TO_CACHE.includes(new URL(event.request.url).pathname)) {
        event.respondWith(handleFetch(event));
    }
});

// Stale-while-revalidate
async function handleFetch(event: FetchEvent) {
    return firstTrue([
        caches.match(event.request),
        fetchAndCache(event.request),
    ]).catch((error: unknown) => {
        console.error('Fetch failed; returning offline page instead.', error);
        return new Response('Offline', { status: 503 });
    });
}

async function fetchAndCache(request: Request) {
    const response = await fetch(request);
    await checkLogout(response);
    if (response.ok && !response.redirected) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
    }
    return response;
}

async function checkLogout(response: Response) {
    if (response.redirected && response.url.endsWith('/login')) {
        await caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName)),
                ),
            );
    }
}

function firstTrue<T>(promises: Promise<T | undefined>[]): Promise<T> {
    const newPromises = promises.map(
        (p) =>
            new Promise((resolve, reject) =>
                p.then((v) => (v ? resolve(v) : reject(v)), reject),
            ),
    ) as Promise<T>[];
    return Promise.any(newPromises);
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
