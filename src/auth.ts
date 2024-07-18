import cookie from 'cookie';

import {
    type CipherGCMTypes,
    createCipheriv,
    createDecipheriv,
    randomBytes,
    randomUUID,
    scryptSync,
} from 'node:crypto';
import logger from 'logger';
import { Schema, model } from 'mongoose';
const log = logger.child({ module: 'auth' });
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import { getDateToday, secondsNow } from 'utils';
import { type WhatsappLoginResult, whatsappLogin } from 'whatsapp';
import { z } from 'zod';

const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24 * 7 * 3; // 3 weeks

export interface User {
    name: string;
    companyID: string;
    userID: string;
    phoneNumber: string;
    lastAuth?: number; // in seconds
}
const mUser = new Schema<User>({
    userID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    companyID: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    lastAuth: { type: Number, required: false, expires: MAX_AUTH_AGE_SECONDS },
});
const Users = model<User>('User', mUser);

if (!process.env.USERID_SECRET)
    throw new Error('USERID_SECRET env variable must be defined');

const encryptionAlgorithm: CipherGCMTypes = 'aes-256-gcm';

function encryptUserID(userID: string): string {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    // biome-ignore lint/style/noNonNullAssertion: it was already checked above
    const key = scryptSync(process.env.USERID_SECRET!, salt, 32);
    const cipher = createCipheriv(encryptionAlgorithm, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(userID, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const res = `${getDateToday()}|${salt.toString('base64')}|${iv.toString('base64')}|${authTag.toString('base64')}|${encrypted.toString('base64')}`;
    return encodeURIComponent(res);
}

function decryptUserID(encryptedData: string): {
    userID?: string;
    encryptDate?: string;
} {
    try {
        const decryptedUserID = decodeURIComponent(encryptedData);
        const parts = decryptedUserID.split('|');
        if (parts.length !== 5) {
            log.error('Invalid encrypted data format');
            return {};
        }
        const [encryptDate, salt, iv, authTag, encryptedText] = parts.map(
            (part) => Buffer.from(part, 'base64'),
        );
        // biome-ignore lint/style/noNonNullAssertion: it was already checked above
        const key = scryptSync(process.env.USERID_SECRET!, salt, 32);
        const decipher = createDecipheriv(encryptionAlgorithm, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final(),
        ]);
        return {
            userID: decrypted.toString('utf8'),
            encryptDate: encryptDate.toString('utf8'),
        };
    } catch (e) {
        log.error(`Error decrypting userID: ${(e as Error)?.message ?? e}`);
        return {};
    }
}

const TEMP_TOKEN_EXPIRATION_MS = 1000 * 60 * 10; // 10 minutes
const tempTokens = new Map<string, { userID: string; expiration: number }>();

export function generateTempToken(user: User) {
    const token = randomUUID();
    const expiration = Date.now() + TEMP_TOKEN_EXPIRATION_MS;
    tempTokens.set(token, { userID: user.userID, expiration });
    setTimeout(() => tempTokens.delete(token), TEMP_TOKEN_EXPIRATION_MS);
    return token;
}

function validateTempToken(token: string) {
    const data = tempTokens.get(token);
    if (!data) return false;
    if (data.expiration < Date.now()) {
        tempTokens.delete(token);
        return false;
    }
    return data.userID;
}

export async function userFromTempToken(token: string | null) {
    if (!token) return undefined;
    const userID = validateTempToken(token);
    if (!userID) return undefined;
    return getUser(userID);
}

export async function validateUserID(userID: string) {
    return await Users.exists({ userID }).setOptions({
        sanitizeFilter: true,
    });
}

// [IMPORTANT] should only be called with validated userID (from validateUserID(id))
export async function getUser(userID: string) {
    const user = await Users.findOne<User>({ userID }).setOptions({
        sanitizeFilter: true,
    });
    if (!user) {
        throw new Error(
            'userID not found in getUser() (should not happen, validateUserID() first)',
        );
    }
    return user;
}

export async function getUsersWithFreshLastAuth() {
    return await Users.find({
        lastAuth: { $gt: secondsNow() - 60 * 60 * 24 * 10 }, // 10 days
    });
}

export async function setLastAuth(userID: User['userID']) {
    return await Users.updateOne({ userID }, { lastAuth: secondsNow() });
}

export async function userIDFromReqHeader(req: IncomingMessage) {
    const c = req.headers.cookie;
    if (!c) {
        return {};
    }
    const parsedUserID = cookie.parse(c)['__Host-userID'];
    if (parsedUserID) {
        return decryptUserID(parsedUserID);
    }
    return {};
}

function userIDtoCookie(userID: User['userID'], deleteCookie = false) {
    return cookie.serialize('__Host-userID', userID, {
        path: '/',
        maxAge: deleteCookie ? 0 : MAX_AUTH_AGE_SECONDS,
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
    });
}

export function encryptedCookieHeader(userID: string, deleteCookie = false) {
    return {
        'Set-Cookie': userIDtoCookie(encryptUserID(userID), deleteCookie),
    };
}

export const loginDataParser = z.object({
    userID: z.string(),
});

export async function handleLogin(
    data: z.infer<typeof loginDataParser>,
    skipQr = false,
): Promise<[result: WhatsappLoginResult, options?: OutgoingHttpHeaders]> {
    if (!(await validateUserID(data.userID))) {
        return [{ success: false, error: 'Invalid userID' }];
    }
    const user = await getUser(data.userID);
    log.info(`user ${user.name} is attempting to login`);
    if (
        skipQr ||
        (user.lastAuth && secondsNow() - user.lastAuth < MAX_AUTH_AGE_SECONDS)
    ) {
        log.info(
            `skipQr: ${skipQr}, lastAuth exist and is < 3 weeks: ${user.lastAuth && secondsNow() - user.lastAuth < MAX_AUTH_AGE_SECONDS}`,
        );
        return [{ success: true }, encryptedCookieHeader(data.userID)];
    }
    log.info(`user ${user.name} is re-authenticating`);
    // else re-authenticate
    const res = await whatsappLogin(user);
    // success means user was already logged in
    if ('success' in res && res.success) {
        log.info(`user ${user.name} was found to be already authenticated`);
        return [res, encryptedCookieHeader(data.userID)];
    }
    log.info(
        `res from (${user.name}) login req: ${JSON.stringify(res, null, 2)}`,
    );
    return [res];
}
