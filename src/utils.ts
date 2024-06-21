import type { IncomingMessage } from 'node:http';

export const elapsedTimeSince = (since: number) => {
    const diff = Date.now() - since;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
};

export function pathOfRequest(req: IncomingMessage) {
    const url = new URL(`http://${req.headers.host}${req?.url || ''}`);
    const pathname = url.pathname;
    const string =
        pathname.endsWith('/') && pathname.length > 1
            ? pathname.slice(0, -1)
            : pathname;
    return {
        path: {
            string,
            is: (p: string) => string === p,
            oneOf: (paths: string[]) => paths.some((p) => string === p),
        },
        query: url.searchParams,
    };
}

export const isValidJsonPOST = (req: IncomingMessage) =>
    req.method === 'POST' &&
    req.headers['content-type'] === 'application/json' &&
    (req.headers['transfer-encoding'] !== undefined ||
        // @ts-expect-error isNaN typecast to number
        // biome-ignore lint/suspicious/noGlobalIsNan: typecast is expected
        !isNaN(req.headers['content-length']));

export async function getRequestBody(req: IncomingMessage) {
    if (!isValidJsonPOST(req)) {
        throw new Error('Invalid POST request');
    }
    return new Promise<string>((resolve, reject) => {
        let data = '';
        req.on('error', reject);
        //req.on('close', () => reject(new Error('Connection closed')));
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
    });
}
