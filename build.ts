const test = process.argv[2] === 'test';

if (test) {
    console.log('Building test.js...');
    await Bun.build({
        entrypoints: ['./src/test.ts'],
        outdir: './dist',
        target: 'node',
        //minify: true,
        sourcemap: 'linked', //external',
        external: ['@whiskeysockets/baileys', 'openai', 'mongoose'],
    });
    console.log('test.js build complete');
    process.exit(0);
}

// *** BUILDING SERVER.JS ***

console.log('building server.js');
const serverRes = await Bun.build({
    entrypoints: ['./src/server.ts'],
    outdir: './dist',
    target: 'node',
    minify: true,
    sourcemap: 'external', // external
    external: ['@whiskeysockets/baileys', 'openai', 'mongoose'],
});
console.log('server.js build complete');
console.log(serverRes);

// *** BUILDING FRONTEND ***

console.log('building fetch-and-qr.js');
const frontRes = await Bun.build({
    entrypoints: ['./pages/fetch-and-qr.ts'],
    outdir: './dist',
    target: 'browser',
    minify: true,
    sourcemap: 'external', // external
});
console.log('fetch-and-qr.js build complete');
console.log(frontRes);

// *** BUILDING SERVICE WORKER ***
console.log('building service-worker.js');
const swRes = await Bun.build({
    entrypoints: ['./pages/service-worker.ts'],
    outdir: './dist',
    target: 'browser',
    minify: true,
    sourcemap: 'external', // external
});
console.log('service-worker.js build complete');
console.log(swRes);

//console.log(`Build result:\n${JSON.stringify(result, null, 2)}`);
