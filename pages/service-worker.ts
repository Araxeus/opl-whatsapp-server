/// <reference lib="webworker" />
export type {};
declare let self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 1;
const CACHE_NAME = `offline-cache-v${CACHE_VERSION}`;
const PROTECTED_ROUTES = ['/', '/park-car', '/replace-client-car'];
const ROUTES_TO_CACHE = [...PROTECTED_ROUTES, '/fetch-and-qr.js', '/form.css'];

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
    console.debug(event.request); // DELETE
    // check if the url which the request comes from is / and the request is for /login
    if (
        event.request.url.endsWith('/login') &&
        event.request.referrer &&
        URL.canParse(event.request.referrer) &&
        new URL(event.request.referrer).origin === self.location.origin
    ) {
        console.info('logout detected');
        event.waitUntil(deleteCache());
        return;
    }
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
    const response = await fetch(request, { redirect: 'manual' });
    console.debug(response); // DELETE !!!!!!! DEBUG
    if (
        response.type === 'opaqueredirect' &&
        response.headers.get('location') === '/login'
    ) {
        await deleteCache();
    }
    if (response.ok && response.status === 200 && !response.redirected) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, await cleanResponse(response));
    }
    return response;
}

async function deleteCache() {
    if (!(await caches.has(CACHE_NAME))) return Promise.resolve();
    console.debug('Deleting cache');
    for (const route of PROTECTED_ROUTES) {
        void fetch(route, { cache: 'reload' });
    }
    return caches.delete(CACHE_NAME);
}

async function cleanResponse(response: Response) {
    const res = response.clone();
    return new Response(res.body ? res.body : await res.blob(), {
        headers: res.headers,
        status: res.status,
        statusText: res.statusText,
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
