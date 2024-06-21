import { getUser } from 'auth';
import logger from 'logger';
import type { SSE_Controller } from 'sse';

import { elapsedTimeSince } from 'utils';

const log = logger.child({ module: 'connection-manager' });

type ConnectionDataConstructor = {
    userID: string;
    controller: SSE_Controller;
    onAbort?: () => void;
};
interface ConnectionData extends ConnectionDataConstructor {
    createdAt: number;
}
type UserID = string;

const connections: { [key: string]: ConnectionData } = {};

export class Connection {
    #userID: string;

    constructor(options: ConnectionDataConstructor | UserID) {
        if (typeof options === 'string') {
            // trying to connect to existing connection
            this.#userID = options;
            this.#checkConnectionExists('connect to ');
            return;
        }

        const { userID, controller, onAbort } = options;

        if (userID in connections) {
            throw new Error(
                '[SSE ERROR] Connection for the same userID already exists',
            );
        }

        this.#userID = userID;

        connections[userID] = {
            userID,
            controller,
            onAbort,
            createdAt: Date.now(),
        };
    }

    #checkConnectionExists(actionVerb: string) {
        if (!connections[this.#userID]) {
            throw new Error(
                `[SSE ERROR] trying to ${actionVerb} a connection that does not exist`,
            );
        }
    }

    close() {
        log.info('called Connection<>.close()'); // DELETE
        if (!connections[this.#userID]) {
            log.info('Connection does not exist'); // DELETE
            return false;
        }
        connections[this.#userID].onAbort?.();
        connections[this.#userID].controller.close();
        delete connections[this.#userID];
        return true;
    }

    setOnAbort(onAbort: () => void) {
        log.info('called Connection<>.setOnAbort()'); // DELETE
        this.#checkConnectionExists('set onAbort');
        connections[this.#userID].onAbort = onAbort;
    }

    hasOnAbort() {
        //log('called Connection<>.hasOnAbort()'); // DELETE
        this.#checkConnectionExists('check onAbort');
        return !!connections[this.#userID].onAbort;
    }

    send(data: string) {
        log.info('called Connection<>.broadcast()'); // DELETE
        this.#checkConnectionExists('broadcast');
        connections[this.#userID].controller.write(data);
    }

    emit(event: string, data = 'NODATA') {
        log.info('called Connection<>.emit()'); // DELETE
        this.#checkConnectionExists('emit');
        connections[this.#userID].controller.write(event, data);
    }

    // fails silently if connection doesn't exist
    static get(userID: string) {
        try {
            return new Connection(userID);
        } catch (_) {
            return undefined;
        }
    }

    static connectionExists(userID: string) {
        return !!connections[userID];
    }

    static async listAll() {
        return Object.keys(connections)
            .map(async (userID) => {
                const user = await getUser(userID);
                const elapsedTime = elapsedTimeSince(
                    connections[userID].createdAt,
                );
                return `${userID} (${user.name}) uptime: ${elapsedTime}`;
            })
            .join('\n');
    }
}
