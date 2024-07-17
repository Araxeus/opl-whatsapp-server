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
    console.log('Service worker fetching:', event.request.url); // DELETE
    if (ROUTES_TO_CACHE.includes(new URL(event.request.url).pathname)) {
        event.respondWith(handleFetch(event));
    } else if (event.request.url.endsWith('logout')) {
        console.log('Logging out; deleting all caches');
        event.waitUntil(deleteAllCaches());
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
    console.log(response); // DELETE !!!!!!! DEBUG
    if (response.redirected && response.url.endsWith('/login')) {
        await deleteAllCaches();
    }
    if (response.ok && response.status === 200 && !response.redirected) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, await cleanResponse(response));
    }
    return response;
}

function deleteAllCaches() {
    return caches
        .keys()
        .then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName)),
            ),
        );
}

function cleanResponse(response: Response) {
    const res = response.clone();
    const bodyPromise = res.body ? Promise.resolve(res.body) : res.blob();

    return bodyPromise.then((body: BodyInit | null | undefined) => {
        // new Response() is happy when passed either a stream or a Blob.
        return new Response(body, {
            headers: res.headers,
            status: res.status,
            statusText: res.statusText,
        });
    });
}

function firstTrue<T>(promises: Promise<T | undefined>[]): Promise<T> {
    const newPromises = promises.map(
        (p) =>
            new Promise((resolve, reject) =>
                p.then((v) => {
                    v ? resolve(v) : reject(new TypeError());
                }, reject),
            ) as Promise<T>,
    );
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
