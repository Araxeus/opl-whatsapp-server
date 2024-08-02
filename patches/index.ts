import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function patchFileContent(
    filepath: string,
    replacer: (scriptContent: string) => string,
) {
    const realpath = path.resolve(import.meta.dir, filepath);
    const scriptContent = await readFile(realpath, 'utf-8');
    const patchedContent = replacer(scriptContent);
    await writeFile(realpath, patchedContent);
    console.log(`Patched ${realpath}`);
}

import './sweetalert2.ts';
