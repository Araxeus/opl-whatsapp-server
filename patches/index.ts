import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function patchFileContent(
    filepath: string,
    replacer: (scriptContent: string) => string,
) {
    if (!filepath || filepath.includes('\0')) {
        throw new Error('Invalid filepath');
    }
    const realpath = path.resolve(import.meta.dir, filepath);
    // check that realpath is within the project directory
    if (!realpath.startsWith(path.resolve(import.meta.dir, '..'))) {
        throw new Error(`Invalid filepath: ${realpath}`);
    }
    const scriptContent = await readFile(realpath, 'utf-8');
    const patchedContent = replacer(scriptContent);
    await writeFile(realpath, patchedContent);
    console.log(`Patched ${realpath}`);
}

import './sweetalert2.ts';
