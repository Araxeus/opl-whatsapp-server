import { readFile, readdir } from 'node:fs/promises';
import { extname, join as joinPath, resolve as resolvePath } from 'node:path';
import { ilTime } from 'logger';
import type { PathOfRequest } from 'utils';

export enum ContentType {
    TEXT = 'text/plain',
    HTML = 'text/html',
    JSON = 'application/json',
    CSS = 'text/css',
    JS = 'text/javascript',
    PNG = 'image/png',
    JPG = 'image/jpeg',
    ICO = 'image/x-icon',
    WASM = 'application/wasm',
}

const files = new Map<string, { content: string; type: ContentType }>();

async function loadFileInMemory(path: string, type: ContentType) {
    const file = await readFile(path);
    const content = file.toString();
    files.set(path, { content, type });
    return content;
}

export async function getFile(path: string, contentType?: ContentType) {
    const type = contentType ?? (await getAssetType(path));
    if (!files.has(path)) {
        await loadFileInMemory(path, type);
    }
    const file = files.get(path);
    if (!file) {
        throw new Error(`File not found: ${path}`);
    }
    return file;
}

const folders = new Map<string, string[]>();
export async function isInFolder(folder: string, path: PathOfRequest['path']) {
    if (!folders.has(folder)) {
        folders.set(
            folder,
            (await readdir(folder)).map((f) => `/${f}`),
        );
    }
    const files = folders.get(folder);
    if (!files) {
        throw new Error(`Folder not found: ${folder}`);
    }
    if (path.oneOf(files)) {
        return true;
    }
    return false;
}

export async function getAssetType(path: string) {
    const ext = extname(path);
    switch (ext) {
        case '.png':
            return ContentType.PNG;
        case '.jpg':
            return ContentType.JPG;
        case '.ico':
            return ContentType.ICO;
        case '.html':
            return ContentType.HTML;
        case '.css':
            return ContentType.CSS;
        case '.js':
            return ContentType.JS;
        case '.wasm':
            return ContentType.WASM;
        default:
            return ContentType.TEXT;
    }
}

const files404Path = resolvePath('pages', '404');
const files404 = await readdir(files404Path);
export function getRandom404() {
    return joinPath(
        files404Path,
        // bearer:disable javascript_lang_insufficiently_random_values
        files404[Math.floor(Math.random() * files404.length)],
    );
    // return files404[Math.floor(Math.random() * files404.length)];
}

let cachedIndexParts: string[]; // [0] before greeting, [1] after greeting
export async function getIndexHtml(name: string) {
    const currentHour = ilTime().getHours();
    let greeting: string;
    if (currentHour < 12 && currentHour >= 6) {
        greeting = 'בוקר טוב';
    } else if (currentHour < 18 && currentHour >= 12) {
        greeting = 'צהריים טובים';
    } else if (currentHour < 22 && currentHour >= 18) {
        greeting = 'ערב טוב';
    } else {
        greeting = 'לילה טוב';
    }

    const firstName = name.split(' ')[0];

    if (!cachedIndexParts) {
        const file = await readFile('./pages/index.html');
        cachedIndexParts = file
            .toString()
            .split(/<h1 dir="rtl" id="greeting">.*?<\/h1>/);
    }

    return `${cachedIndexParts[0]}<h1 dir="rtl" id="greeting">${greeting} ${firstName},</h1>${cachedIndexParts[1]}`;
}
