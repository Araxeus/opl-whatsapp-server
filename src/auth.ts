import cookie from 'cookie';

import {
    createCipheriv,
    createDecipheriv,
    randomUUID,
    scryptSync,
} from 'node:crypto';
import logger from 'logger';
import { Schema, model } from 'mongoose';
const log = logger.child({ module: 'auth' });
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import { type WhatsappLoginResult, whatsappLogin } from 'whatsapp';
import { z } from 'zod';

export interface User {
    name: string;
    companyID: string;
    userID: string;
    phoneNumber: string;
    lastAuth?: ReturnType<typeof Date.now>;
}
const mUser = new Schema<User>({
    userID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    companyID: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    lastAuth: { type: Number, required: false, expires: 60 * 60 * 24 * 7 * 3 },
});
const Users = model<User>('User', mUser);

if (!process.env.USERID_SECRET)
    throw new Error('USERID_SECRET env variable must be defined');
if (!process.env.USERID_IV) throw new Error('IV env variable must be defined');

const encryptionAlgorithm = 'aes-256-cbc';
const key = scryptSync(process.env.USERID_SECRET, 'salt', 32);
const iv = Buffer.from(process.env.USERID_IV, 'hex');

function encryptUserID(userID: string) {
    const cipher = createCipheriv(encryptionAlgorithm, key, iv);
    return cipher.update(userID, 'utf8', 'hex') + cipher.final('hex');
}

function decryptUserID(encryptedText: string) {
    try {
        const decipher = createDecipheriv(encryptionAlgorithm, key, iv);
        return (
            decipher.update(encryptedText, 'hex', 'utf8') +
            decipher.final('utf8')
        );
    } catch (e) {
        return undefined;
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

export async function validateUserID(userID: User['userID']) {
    return await Users.exists({ userID });
}

// [IMPORTANT] should only be called with validated userID (from validateUserID(id))
export async function getUser(userID: User['userID']) {
    const user = await Users.findOne({ userID });
    if (!user) {
        throw new Error(
            'userID not found in getUser() (should not happen, validateUserID() first)',
        );
    }
    return user;
}

export async function getUsersWithFreshLastAuth() {
    return await Users.find({
        lastAuth: { $gt: Date.now() - 1000 * 60 * 60 * 24 * 10 }, // 10 days
    });
}

export async function setLastAuth(userID: User['userID']) {
    return await Users.updateOne({ userID }, { lastAuth: Date.now() });
}

export async function userIDFromReqHeader(req: IncomingMessage) {
    const c = req.headers.cookie;
    if (!c) {
        return undefined;
    }
    const parsedUserID = cookie.parse(c)['__Host-userID'];
    if (parsedUserID) {
        return decryptUserID(parsedUserID);
    }
    return undefined;
}

function userIDtoCookie(userID: User['userID'], deleteCookie = false) {
    return cookie.serialize('__Host-userID', userID, {
        path: '/',
        maxAge: deleteCookie ? 0 : 60 * 60 * 24 * 7 * 3, // 3 week,
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
    log.info(`user ${user.name} is trying to login`); // DELETE
    // check that lastAuth exist and is not older than 3 weeks
    if (
        skipQr ||
        (user.lastAuth &&
            Date.now() - user.lastAuth < 1000 * 60 * 60 * 24 * 7 * 3)
    ) {
        log.info(
            `skipQr: ${skipQr}, lastAuth exist and is < 3 weeks: ${user.lastAuth && Date.now() - user.lastAuth < 1000 * 60 * 60 * 24 * 7 * 3}`,
        ); // DELETE
        return [{ success: true }, encryptedCookieHeader(data.userID)];
    }
    log.info(`user ${user.name} is re-authenticating`); // DELETE
    // else re-authenticate
    const res = await whatsappLogin(user);
    // success means user was already logged in
    if ('success' in res && res.success) {
        log.info(`user ${user.name} was found to be already authenticated`); // DELETE
        return [res, encryptedCookieHeader(data.userID)];
    }
    log.info(
        `res from (${user.name}) login req: ${JSON.stringify(res, null, 2)}`,
    ); // DELETE
    // { success: false, error } | { qrCode, tempToken }
    return [res];
}
