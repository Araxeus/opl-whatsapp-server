import { createReadStream } from 'node:fs';
import http from 'node:http';
import {
    encryptedCookieHeader,
    getUser,
    handleLogin,
    loginDataParser,
    userFromTempToken,
    userIDFromReqHeader,
    validateUserID,
} from 'auth';
import {
    ContentType,
    assets,
    getAssetType,
    getFile,
    getIndexHtml,
    getRandom404,
} from 'cache';
import logger from 'logger';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import speech from 'speech';
import { sse } from 'sse';
import { getRequestBody, pathOfRequest } from 'utils';
import { handleWhatsappRoutine } from 'whatsapp';
import { type CarParkingInfo, CarParkingInfoSchema } from 'whatsapp/park-car';
import {
    type ReplaceClientCarInfo,
    ReplaceClientCarSchema,
} from 'whatsapp/replace-client-car';
import type { z } from 'zod';

if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be defined');
}

logger.info('connecting to mongo');
await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'operate-whatsapp-server',
});
logger.info(
    `MongoDB connected to:\n\t${mongoose.connection.host}:${mongoose.connection.port}\n\tDatabase name = "${mongoose.connection.db.databaseName}"`,
);

const HOST = process.env.HOST || '127.0.0.1'; // || 0.0.0.0 || 'localhost';
const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(async (req, res) => {
    let log = logger.child({ reqID: nanoid(5) });
    function response(
        message: string,
        type = ContentType.TEXT,
        status = 200,
        headers: http.OutgoingHttpHeaders = {},
    ) {
        res.writeHead(status, { 'Content-Type': type, ...headers });
        res.end(message);
        if (status === 200 && type === ContentType.TEXT) return;
        log.info(
            `Response: ${status} | ${type}${
                message.length < 200 ? ` | ${message}` : ''
            }`,
        );
    }

    async function fileResponse(
        path: string,
        type?: ContentType,
        status = 200,
        headers?: http.OutgoingHttpHeaders,
    ) {
        const file = await getFile(path, type);
        response(file.content, file.type, status, headers);
    }

    async function streamResponse(path: string, status = 200) {
        const assetType = await getAssetType(path);
        res.writeHead(status, { 'Content-Type': assetType });
        createReadStream(path).pipe(res);
    }

    const { path, query } = pathOfRequest(req);

    if (path.is('/healthcheck')) return response('Healthy!');

    const userAgent = req.headers['user-agent'];
    const ip = req.headers['true-client-ip'];
    const ipCountry = req.headers['cf-ipcountry']; //req.url
    log.info(`Got request for: ${path.string} ${query.size ? `| ${query.toString()}` : ''}
    user-agent: ${userAgent}\n\tip: ${ip}\n\tcountry: ${ipCountry}`);

    if (path.is('/keepalive')) return response('ty');

    if (path.oneOf(assets)) {
        return streamResponse(`./assets${path.string}`);
    }

    if (path.is('/vendor/qrcode.js'))
        return fileResponse('./vendor/qrcode-updatedeps.js', ContentType.JS);

    if (path.is('/form.css'))
        return fileResponse('./pages/form.css', ContentType.CSS);

    if (path.is('/fetch-and-qr.ts')) {
        return fileResponse('./dist/fetch-and-qr.js', ContentType.JS);
    }

    if (req.method === 'POST' && path.is('/login')) {
        try {
            const body = loginDataParser.parse(await getRequestBody(req));
            const [result, headers] = await handleLogin(
                body,
                !!query.get('skipqr'),
            );
            return response(
                JSON.stringify(result),
                ContentType.JSON,
                'error' in result ? 401 : 200,
                headers,
            );
        } catch (error) {
            return response(
                error?.toString?.() || 'Unknown Error while parsing POST',
                ContentType.TEXT,
                400,
            );
        }
    }

    //Server Sent Events from login page using tempToken (valid for 10 minutes)
    if (path.is('/sse') && query.has('token')) {
        const user = await userFromTempToken(query.get('token'));
        if (!user) {
            return response('Unauthorized', ContentType.TEXT, 401);
        }
        sse(req, res, user);
        return;
    }

    const userID = await userIDFromReqHeader(req);
    const isUserValid = userID && (await validateUserID(userID));

    if (path.is('/login')) {
        if (isUserValid) {
            return response('Already Logged In', ContentType.TEXT, 302, {
                location: '/',
            });
        }
        return fileResponse('./pages/login.html', ContentType.HTML);
    }

    if (!isUserValid) {
        return response('Unauthorized', ContentType.TEXT, 302, {
            location: '/login',
        });
    }

    // *********************************
    // ***** USER IS AUTHENTICATED *****
    // *********************************

    const user = await getUser(userID);
    const loginCookie = encryptedCookieHeader(userID);

    log.info(`Request authenticated as from ${user.name}`);
    log = log.child({ user: user.name });

    if (path.is('/'))
        return response(await getIndexHtml(user.name), ContentType.HTML);

    if (path.is('/park-car')) {
        return fileResponse(
            './pages/park-car.html',
            ContentType.HTML,
            200,
            loginCookie,
        );
    }

    if (path.is('/replace-client-car')) {
        return fileResponse(
            './pages/replace-client-car.html',
            ContentType.HTML,
            200,
            loginCookie,
        );
    }

    const handleRoutine = async (validator: z.AnyZodObject) => {
        try {
            const body = validator.parse(await getRequestBody(req)) as
                | CarParkingInfo
                | ReplaceClientCarInfo;
            log.info(`POST request body:\n${JSON.stringify(body, null, 2)}`);
            const result = await handleWhatsappRoutine(user, body);
            return response(
                JSON.stringify(result),
                ContentType.JSON,
                'error' in result ? 400 : 200,
            );
        } catch (error) {
            return response(
                error?.toString?.() || 'Unknown Error while parsing POST',
                ContentType.TEXT,
                400,
            );
        }
    };

    if (path.is('/api/park-car') && req.method === 'POST') {
        return await handleRoutine(CarParkingInfoSchema);
    }

    if (path.is('/api/replace-client-car') && req.method === 'POST') {
        return await handleRoutine(ReplaceClientCarSchema);
    }

    //Server Sent Events
    if (path.is('/sse')) {
        return sse(req, res, user);
    }

    if (path.is('/speech')) {
        // DELETE this and the file
        return fileResponse('./pages/speech.html', ContentType.HTML, 200);
    }

    if (req.method === 'POST' && path.is('/speech')) {
        try {
            const body = await getRequestBody(req, true);
            log.info(`POST request body:\n${body}`);
            const result = await speech.inferCarData(body);
            log.info(`Speech result:\n${JSON.stringify(result, null, 2)}`);
            return response(result, ContentType.JSON);
        } catch (error) {
            return response(
                error?.toString?.() || 'Unknown Error while parsing POST',
                ContentType.TEXT,
                400,
            );
        }
    }

    if (path.is('/logout')) {
        return fileResponse('./pages/login.html', ContentType.HTML, 302, {
            location: '/login',
            ...encryptedCookieHeader(userID, true),
        });
    }

    return fileResponse(getRandom404(), ContentType.HTML, 404);
});

server.listen(PORT, HOST, () => {
    logger.info(`Server running at http://${HOST}:${PORT}/`);
});
