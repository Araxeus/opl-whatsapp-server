import type { IncomingMessage, ServerResponse } from 'node:http';
import type { User } from 'auth';
import log from 'logger';
import { Connection } from './connections-manager';

//const log = logger.child({ module: 'sse' });

export type SSE_Controller = {
    close: () => void;
    write:
        | ((message: string) => void)
        | ((event: string, message?: string) => void);
};

export function sse(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    user: User,
) {
    if (Connection.connectionExists(user.userID)) {
        log.error('[SSE ERROR] Connection for the same userID already exists'); // DELETE
        res.writeHead(400, {
            'Content-Type': 'text/plain',
        });
        res.end('Connection for the same userID already exists');
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    const closeSSE = () => res.end();
    const writeSSE = (messageOrEvent: string, message?: string) => {
        if (message) {
            res.write(`event: ${messageOrEvent}\n`);
        }
        res.write(`data: ${JSON.stringify(message ?? messageOrEvent)}\n\n`);
    };

    const connection = new Connection({
        userID: user.userID,
        controller: {
            close: closeSSE,
            write: writeSSE,
        },
    });

    req.on('close', () => {
        log.info(`SSE connection closed by user ${user.name}`);
        connection.close();
    });
}
