import readline from 'node:readline';
import { getUser, validateUserID } from 'auth';
import log from 'logger';
import mongoose from 'mongoose';
import {
    handleWhatsappRoutine,
    //startWhatsappTest
} from 'whatsapp';

if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be defined');
}

log.info('connecting to mongo');
await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'operate-whatsapp-server',
});
log.info(
    `MongoDB connected to:\n\t${mongoose.connection.host}:${mongoose.connection.port}\n\tDatabase name = "${mongoose.connection.db.databaseName}"`,
);

const rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('$ ');
rl.prompt();

if (!process.env.TEST_USERID || !validateUserID(process.env.TEST_USERID)) {
    throw new Error('TEST_USERID env variable must be defined and valid');
}

const testUser = await getUser(process.env.TEST_USERID);

import speech from 'speech';

rl.on('line', async (_line) => {
    const line = _line.trim();
    if (['q', 'quit', 'exit'].includes(line)) {
        return rl.close();
    }

    const carData = await speech.inferCarData(line, true);
    console.log(carData);

    if (line) return; // DELETE

    if (line === 'start') {
        log.info('Starting whatsapp instance...');
        const result = await handleWhatsappRoutine(testUser, {
            clientCarID: '336-42-708',
            replacementCarID: '802-23-402',
        });
        log.info(`Routine result:\n${JSON.stringify(result, null, 2)}`);
    } else {
        log.error(`Unknown command: "${line}"`);
    }
    //instance.sendMessage(line.trim());
    rl.prompt();
}).on('close', () => {
    log.info('readline closed');
    process.exit(0);
});
