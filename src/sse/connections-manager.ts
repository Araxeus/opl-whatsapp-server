import { getUser } from 'auth';
import type { SSE_Controller } from 'sse';

import { elapsedTimeSince } from 'utils';

type ConnectionDataConstructor = {
    userID: UserID;
    controller: SSE_Controller;
    onAbort?: () => void;
};
interface ConnectionData extends ConnectionDataConstructor {
    createdAt: number;
}
type UserID = string;

const connections: { [key: string]: ConnectionData } = {};

export class Connection {
    #userID: UserID;

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
        if (!connections[this.#userID]) {
            return false;
        }
        connections[this.#userID].onAbort?.();
        connections[this.#userID].controller.close();
        delete connections[this.#userID];
        return true;
    }

    setOnAbort(onAbort: () => void) {
        this.#checkConnectionExists('set onAbort');
        connections[this.#userID].onAbort = onAbort;
    }

    hasOnAbort() {
        this.#checkConnectionExists('check onAbort');
        return !!connections[this.#userID].onAbort;
    }

    send(data: string) {
        this.#checkConnectionExists('broadcast');
        connections[this.#userID].controller.write(data);
    }

    emit(event: string, data = 'NODATA') {
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
        return await Promise.all(
            Object.keys(connections).map(async userID => {
                const user = await getUser(userID);
                const elapsedTime = elapsedTimeSince(
                    connections[userID].createdAt,
                );
                return `${userID} (${user.name}) uptime: ${elapsedTime}`;
            }),
        ).then(res => res.join('\n'));
    }
}
