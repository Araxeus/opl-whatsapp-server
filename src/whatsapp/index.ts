import { type User, generateTempToken, setLastAuth } from 'auth';
import logger from 'logger';
//import qrcodeTerminal from 'qrcode-terminal';
import { WhatsappInstance } from './instance';
import type { CarParkingInfo } from './park-car';
import type { ReplaceClientCarInfo } from './replace-client-car';

const log = logger.child({ module: 'whatsapp' });

export async function startWhatsappTest(user: User) {
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
                instance.close();
            });
        });
    });
}

export type WhatsappRoutineResult = RoutineResult | { qrCode: string };
export async function handleWhatsappRoutine(
    user: User,
    data: CarParkingInfo | ReplaceClientCarInfo,
): Promise<WhatsappRoutineResult> {
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
            log.info('Instance opened');
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
        });
    });
}
