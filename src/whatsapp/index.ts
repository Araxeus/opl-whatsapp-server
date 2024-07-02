import {
    type User,
    generateTempToken,
    getUsersWithFreshLastAuth,
    setLastAuth,
} from 'auth';
import logger from 'logger';
//import qrcodeTerminal from 'qrcode-terminal';
import { WhatsappInstance } from './instance';
import type { CarParkingInfo } from './park-car';
import type { ReplaceClientCarInfo } from './replace-client-car';

export async function startWhatsappTest(user: User) {
    const log = logger.child({ module: `startWhatsappTest of ${user.name}` });

    log.info('Starting whatsapp instance...');
    const instance = new WhatsappInstance(user);

    instance.on('error', (e) => {
        log.error(`Error: ${JSON.stringify(e, null, 2)}`);
    });

    instance.on('qr', (_qrCode) => {
        log.info('QR code received');
        //qrcodeTerminal.generate(qrCode, { small: true });
    });

    return new Promise<WhatsappInstance>((resolve) => {
        instance.once('open', () => {
            log.info('Instance opened');
            resolve(instance);
        });
    });
}

type RoutineResult = { success: true } | { success: false; error: unknown };

export type WhatsappLoginResult =
    | RoutineResult
    | { qrCode: string; tempToken: string };

export async function whatsappLogin(user: User): Promise<WhatsappLoginResult> {
    const log = logger.child({ module: `whatsappLogin of ${user.name}` });

    if (WhatsappInstance.instanceExists(user.userID)) {
        log.error('Instance already exists');
        return {
            success: false,
            error: 'החיבור נכשל כי המערכת מחוברת לוואצאפ של המשתמש, אנא נסה שנית עוד דקה',
        };
    }

    log.info('Starting whatsapp instance...');
    const instance = new WhatsappInstance(user);

    instance.on('error', (e) => {
        log.error(`Error: ${JSON.stringify(e, null, 2)}`);
    });

    return new Promise((resolve) => {
        instance.once('qr', (qrCode: string) => {
            log.info('QR code received');
            //qrcodeTerminal.generate(qrCode, { small: true });
            const tempToken = generateTempToken(user);
            resolve({ qrCode, tempToken });
        });

        instance.once('open', () => {
            log.info('Instance opened');
            resolve({ success: true });
            instance.once('save', () => {
                setTimeout(() => {
                    setLastAuth(user.userID);
                    instance.close();
                }, 1000 * 60);
            });
        });
    });
}

export type WhatsappRoutineResult = RoutineResult | { qrCode: string };
export async function handleWhatsappRoutine(
    user: User,
    data: CarParkingInfo | ReplaceClientCarInfo,
): Promise<WhatsappRoutineResult> {
    const log = logger.child({
        module: `handleWhatsappRoutine of ${user.name}`,
    });

    if (WhatsappInstance.instanceExists(user.userID)) {
        log.error('Instance already exists');
        return { success: false, error: 'המערכת כבר בתהליך דיווח' };
    }

    log.info('Starting whatsapp instance...');
    const instance = new WhatsappInstance(user);

    instance.on('error', (e) => {
        log.error(`Error: ${JSON.stringify(e, null, 2)}`);
    });

    return new Promise((resolve) => {
        instance.once('qr', (qrCode: string) => {
            log.info('QR code received');
            resolve({ qrCode });
        });
        instance.once('open', () => {
            setTimeout(() => {
                setLastAuth(user.userID);
                instance
                    .routine(data)
                    .then((res) => {
                        resolve(res);
                    })
                    .catch((e) => {
                        log.error(`Error: ${JSON.stringify(e, null, 2)}`);
                        resolve({ success: false, error: e });
                    })
                    .finally(() => {
                        setTimeout(() => {
                            instance.close();
                        }, 1500);
                    });
            }, 1000 * 4);
            // 4 seconds delay to allow the instance to be ready
        });
    });
}

// export async function refreshAllInstances() {
//     // concurrent instances
//     const log = logger.child({ module: 'refreshAllInstances' });

//     const users = await getUsersWithFreshLastAuth();

//     log.info('Refreshing all instances...');
//     const promises = users.map((user) => {
//         return new Promise<{
//             user: User;
//             success: boolean;
//             error?: string | Error;
//         }>((resolve) => {
//             if (WhatsappInstance.instanceExists(user.userID)) {
//                 log.error('Instance already exists');
//                 resolve({
//                     user,
//                     success: false,
//                     error: 'Instance already exists',
//                 });
//             }
//             const instance = new WhatsappInstance(user);

//             instance.on('error', (e) => {
//                 log.error(`Error: ${JSON.stringify(e, null, 2)}`);
//             });

//             instance.once('qr', () => {
//                 resolve({
//                     user,
//                     success: false,
//                     error: 'Instance asked for QR code',
//                 });
//             });
//             instance.once('open', () => {
//                 log.info(
//                     'Instance opened.. waiting for save event then 60sec to close',
//                 );
//                 instance.once('save', () => {
//                     setTimeout(() => {
//                         instance.close();
//                         resolve({ success: true, user });
//                     }, 1000 * 60);
//                 });
//             });
//         });
//     });

//     for (const r of await Promise.all(promises)) {
//         if (r.success) {
//             log.info(`Instance of "${r.user.name}" refreshed successfully`);
//         } else {
//             log.error(
//                 `Error while processing instance of "${r.user.name}": ${r.error}`,
//             );
//         }
//     }
// }

export async function refreshAllInstances() {
    const log = logger.child({ module: 'refreshAllInstances' });

    const users = await getUsersWithFreshLastAuth();

    log.info(
        `Refreshing all instances for users: [${users.map((user) => user.name).join(', ')}]`,
    );
    // const instances = users.map((user) => new WhatsappInstance(user));

    for (const user of users) {
        const res = await refreshWhatsappInstance(user);
        if (!res.success) {
            log.error(
                `Error while processing instance of "${user.name}": ${res.error}`,
            );
            continue;
        }
        log.info(`Instance of "${user.name}" refreshed successfully`);
    }
}

async function refreshWhatsappInstance(user: User): Promise<RoutineResult> {
    const log = logger.child({
        module: `refreshWhatsappInstance of ${user.name}`,
    });

    if (WhatsappInstance.instanceExists(user.userID)) {
        log.error('Instance already exists');
        return { success: false, error: 'המערכת כבר בתהליך דיווח' };
    }

    log.info('Refreshing whatsapp instance...');
    const instance = new WhatsappInstance(user);

    instance.on('error', (e) => {
        log.error(`Error: ${JSON.stringify(e, null, 2)}`);
    });

    return new Promise((resolve) => {
        instance.once('qr', () => {
            resolve({ success: false, error: 'Instance asked for QR code' });
        });

        instance.once('open', () => {
            log.info(
                'Instance opened.. waiting for save event then 60sec to close',
            );
            instance.once('save', () => {
                setTimeout(() => {
                    instance.close();
                    resolve({ success: true });
                }, 1000 * 60);
            });
        });
    });
}
