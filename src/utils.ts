import type { IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';

export const elapsedTimeSince = (since: number) => {
    const diff = Date.now() - since;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
};

export type PathOfRequest = ReturnType<typeof pathOfRequest>;
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

export function getRequestBody(
    req: IncomingMessage,
    raw?: false,
): Promise<object>;
export function getRequestBody(
    req: IncomingMessage,
    raw: true,
): Promise<string>;
export async function getRequestBody(req: IncomingMessage, raw = false) {
    if (!raw && !isValidJsonPOST(req)) {
        throw new Error('Invalid POST request');
    }
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('error', reject);
        //req.on('close', () => reject(new Error('Connection closed')));
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => {
            try {
                resolve(raw ? data : JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Checks if the incoming request is of type audio/wav.
 * @param req IncomingMessage - The incoming HTTP request.
 * @returns boolean - True if the content type is audio/wav, false otherwise.
 */
const isValidAudioWavRequest = (req: IncomingMessage): boolean =>
    req.headers['content-type'] === 'audio/wav';

/**
 * Parses an IncomingMessage with content type audio/wav into a Readable stream.
 * @param req IncomingMessage - The incoming HTTP request.
 * @returns Readable - A readable stream of the audio data.
 * @throws Error if the request does not have the correct content type.
 */
export const parseAudioWavRequest = (req: IncomingMessage): Readable => {
    if (!isValidAudioWavRequest(req)) {
        throw new Error('Invalid request: Content-Type is not audio/wav');
    }

    // The IncomingMessage itself is a readable stream, so we can return it directly
    // if it's a valid audio/wav request.
    return req;
};

export const CSPfromObj = (obj: { [key: string]: string[] }): string =>
    Object.entries(obj)
        .map(
            ([k, v]) =>
                `${k} ${v
                    .map((vv) =>
                        vv.startsWith('http') ||
                        vv.endsWith(':') ||
                        vv === '*' ||
                        vv.startsWith('/')
                            ? vv
                            : `'${vv}'`,
                    )
                    .join(' ')}`,
        )
        .join('; ');

// We are in test mode unless explicitly turned off
export const TEST_MODE = process.env.TEST_MODE !== 'off';
