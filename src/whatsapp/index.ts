import { type User, generateTempToken, setLastAuth } from 'auth';
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
            const hoursSinceLastAuth = user.lastAuth
                ? Math.floor((Date.now() - user.lastAuth) / (1000 * 60 * 60))
                : 100;
            const timeout = Math.max(
                1600,
                Math.min(hoursSinceLastAuth * 150, 15000),
            );
            setLastAuth(user.userID);
            setTimeout(
                () =>
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
                        }),
                timeout,
            );
        });
    });
}
