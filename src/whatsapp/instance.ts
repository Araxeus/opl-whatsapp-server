import type { Boom } from '@hapi/boom';
import '@whiskeysockets/baileys';
import EventEmitter from 'node:events';
import {
    DisconnectReason,
    WAMessageStubType,
    type WAProto,
    type WAVersion,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    isJidGroup,
    isJidStatusBroadcast,
    isJidUser,
    makeWASocket,
} from '@whiskeysockets/baileys';
import type { User } from 'auth';
import logger from 'logger';
import type { Logger } from 'pino';
import { Connection } from 'sse/connections-manager';
import { TEST_MODE } from 'utils';
import {
    type CarParkingInfo,
    type QuestionType as QuestionType_ParkCar,
    customAnswerParkCar,
    questions as questionsParkCar,
} from 'whatsapp/park-car';
import {
    type QuestionType as QuestionType_RequestCar,
    type ReplaceClientCarInfo,
    customAnswerReplaceClientCar,
    questions as questionsReplaceClientCar,
} from 'whatsapp/replace-client-car';
import { OPERATE_PHONE_NUMBER, isCarParkingInfo } from 'whatsapp/shared';
import { getAuthFromDatabase } from './mongo';

//import qrcodeTerminal from 'qrcode-terminal';

type UserID = string;
const activeInstances = new Map<UserID, WhatsappInstance>();

enum QuestionType {
    GREETING = 1,
    REQUEST_TYPE_NEW = 2,
    REQUEST_TYPE = 3,
}

export class WhatsappInstance extends EventEmitter {
    user: User;
    sock!: ReturnType<typeof makeWASocket>;
    version!: WAVersion;
    log: Logger;
    fullSyncNeeded: boolean;
    isConnected = false;

    constructor(user: User, fullsync = false) {
        if (activeInstances.has(user.userID))
            throw new Error('Instance already active, check instanceExists()');

        super();
        this.user = user;
        this.fullSyncNeeded = fullsync;

        this.log = logger.child({
            module: `whatsapp/instance of ${user.name}`,
        });

        fetchLatestBaileysVersion().then(({ version, isLatest }) => {
            this.version = version;
            this.log.info(
                `using WA v${version.join('.')}, isLatest: ${isLatest}`,
            );
            void this.#connect();
        });
    }

    async #connect(): Promise<void> {
        const { state, saveState, clearState } = await getAuthFromDatabase(
            this.user.userID,
        );

        const userPhoneNumber = `${
            this.user.phoneNumber.startsWith('0')
                ? `972${this.user.phoneNumber.slice(1)}`
                : this.user.phoneNumber
        }@s.whatsapp.net`.replace('-', ''); //.replace('+', '')

        const fullSyncNeeded = this.fullSyncNeeded;

        this.sock = makeWASocket({
            version: this.version,
            printQRInTerminal: false,
            auth: state,
            logger: logger.child({
                module: `baileys instance of ${this.user.name}`,
            }),
            shouldIgnoreJid(jid) {
                return (
                    (!fullSyncNeeded &&
                        isJidUser(jid) &&
                        jid !== OPERATE_PHONE_NUMBER &&
                        jid !== userPhoneNumber) ||
                    isJidBroadcast(jid) ||
                    isJidGroup(jid) ||
                    isJidStatusBroadcast(jid) ||
                    (typeof jid === 'string' && jid.endsWith('@newsletter'))
                ); // return jid !== OPERATE_PHONE_NUMBER;
            },
            shouldSyncHistoryMessage(_msg) {
                return fullSyncNeeded || (_msg.syncType ?? 0) <= 1;
            },
            syncFullHistory: false,
        });

        activeInstances.set(this.user.userID, this);

        this.sock.ev.on('messaging-history.set', ({ isLatest }) => {
            if (isLatest) this.log.info('messaging-history.set LATEST');
            else this.log.info('messaging-history.set');
        });

        this.sock.ev.on('creds.update', () => {
            this.log.info('creds updated');
            saveState().then(() => {
                this.emit('save');
            });
        });

        this.sock.ev.on('messages.upsert', messages => {
            if (!messages) return; // || messages.type !== 'notify'

            const isAppend = messages.type === 'append';
            //timestamp is in seconds not ms - so we divide by 1000 to get unix seconds timestamp
            const maxTimestampAge = Math.round(Date.now() / 1000) - 30; // 30 seconds
            for (const message of messages.messages) {
                if (
                    message.key.fromMe ||
                    message.key.remoteJid !== OPERATE_PHONE_NUMBER
                ) {
                    return;
                }
                if (
                    isAppend &&
                    Number(message.messageTimestamp) < maxTimestampAge
                ) {
                    this.log.info('skipping old message');
                    this.log.info(message);
                    return;
                }

                this.log.info(
                    `received message${isAppend ? ' (isAppend)' : ''}: ${JSON.stringify(message, null, 2)}`,
                );
                this.emit('message', message);
            }
        });

        let sentFirstQR = false;

        this.sock.ev.on(
            'connection.update',
            async ({
                connection,
                lastDisconnect,
                qr,
                receivedPendingNotifications,
            }) => {
                this.log.info(
                    `connection update: ${JSON.stringify(connection, null, 2)}`,
                );
                if (qr) {
                    this.log.info('qr code received');
                    this.emit('qr', qr);
                    this.fullSyncNeeded = true;
                    //qrcodeTerminal.generate(qr, { small: true });
                    const sseConnection = Connection.get(this.user.userID);
                    if (sseConnection) {
                        sseConnection.emit('qr', qr);
                        if (!sseConnection.hasOnAbort()) {
                            sseConnection.setOnAbort(() => {
                                if (!this.isConnected) this.close();
                            });
                        }
                    } else if (sentFirstQR) {
                        // we sent the first QR and got a second one, but the sse connection is gone
                        this.close();
                    }
                    sentFirstQR ||= true;
                }
                if (receivedPendingNotifications) {
                    this.log.info(
                        'received pending notifications, emitting "open" event',
                    );
                    this.emit('open');
                }
                if (connection === 'close') {
                    activeInstances.delete(this.user.userID);
                    if (
                        (lastDisconnect?.error as Boom)?.output?.statusCode ===
                        DisconnectReason.loggedOut
                    ) {
                        await clearState();
                    }
                    const shouldReconnect =
                        lastDisconnect?.error?.message !== 'instance.close()';
                    this.log.info(
                        `connection closed due to: ${lastDisconnect?.error?.toString()} ...reconnecting: ${shouldReconnect}`,
                    );
                    // reconnect if not logged out
                    if (shouldReconnect) {
                        void this.#connect();
                    } else {
                        this.emit('close');
                        this.removeAllListeners();

                        //this.sock.ev.flush();
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    Connection.get(this.user.userID)?.emit('authenticated');
                }
            },
        );
    }

    async readMessage(message: WAProto.IMessageKey) {
        if (!activeInstances.has(this.user.userID))
            throw new Error('Instance not active');
        return await this.sock.readMessages([message]);
    }

    async sendMessage(message: string) {
        if (!activeInstances.has(this.user.userID))
            throw new Error('Instance not active');
        return await this.sock.sendMessage(OPERATE_PHONE_NUMBER, {
            text: message,
        });
    }

    close(msg?: string) {
        if (!activeInstances.has(this.user.userID))
            throw new Error('Instance not active');
        this.sock.end(new Error(msg || 'instance.close()'));
        activeInstances.delete(this.user.userID);
    }

    async routine(data: CarParkingInfo | ReplaceClientCarInfo) {
        if (!activeInstances.has(this.user.userID))
            throw new Error('Instance not active');
        const { questions, customAnswer } = isCarParkingInfo(data)
            ? {
                  questions: questionsParkCar(this.user, data),
                  customAnswer: customAnswerParkCar(this.user, data),
              }
            : {
                  questions: questionsReplaceClientCar(this.user, data),
                  customAnswer: customAnswerReplaceClientCar(this.user, data),
              };

        const questionsLength = Object.keys(questions).length;

        return new Promise<{ success: true }>((resolve, reject) => {
            this.on('message', handleOperateMessage);
            const unsubscribeFromMessages = () =>
                this.removeListener('message', handleOperateMessage);

            let chatState = QuestionType.GREETING;

            // Bindings are needed for handleOperateMessage() below
            const readMessage = this.readMessage.bind(this);
            const sendMessage = this.sendMessage.bind(this);
            const log = this.log;

            log.info('Sending initial message');

            sendMessage('.');

            log.info(`Waiting for ${questions[chatState]}`);

            const msgTimeout = {
                timer: undefined as Timer | undefined,
                start: (ms = 1000 * 60) => {
                    msgTimeout.clear();
                    msgTimeout.timer = setTimeout(() => {
                        this.log.error('Message timeout');
                        unsubscribeFromMessages();
                        reject({ success: false, error: 'Message timeout' });
                    }, ms);
                },
                clear: () => {
                    clearTimeout(msgTimeout.timer);
                },
            };

            const stop = () => {
                msgTimeout.clear();
                unsubscribeFromMessages();
            };

            msgTimeout.start();

            const userPhoneNumber = this.user.phoneNumber;
            let gotAlternativeMessage = false;

            function handleOperateMessage(msg: WAProto.IWebMessageInfo) {
                if (msg.key.remoteJid !== OPERATE_PHONE_NUMBER)
                    throw new Error('FATAL ERROR not OPERATE_PHONE_NUMBER');

                msgTimeout.start();

                for (const validator of [
                    isGreetingImage,
                    isNotificationTemplate,
                    isE2ENotification,
                ]) {
                    if (validator(msg, chatState)) return;
                }

                if (
                    !gotAlternativeMessage &&
                    isAlternativeMessage(msg, chatState)
                ) {
                    if (TEST_MODE) {
                        stop();
                        reject({
                            success: false,
                            error: 'Got alternative message in TEST_MODE',
                        });
                        return;
                    }
                    gotAlternativeMessage = true;
                    readMessage(msg.key);
                    sendMessage(userPhoneNumber.replaceAll('-', ''));
                    return;
                }

                if (gotAlternativeMessage && isAgentGreeting(msg)) {
                    readMessage(msg.key);
                    sendMessage(customAnswer);
                    chatState = questionsLength + 1;
                } else if (
                    (questions[chatState].selector?.(msg) ||
                        msg.message?.conversation) ===
                    questions[chatState].question
                ) {
                    if (questions[chatState].waitForUserInput) {
                        msgTimeout.start(1000 * 60 * 5); // 5 minutes
                    } else {
                        readMessage(msg.key);
                        sendMessage(questions[chatState].answer);
                    }
                    chatState++;
                } else {
                    log.error({
                        msg: 'Mismatch error in chatState',
                        expected: questions[chatState],
                    });
                    stop();
                    reject({
                        success: false,
                        error: 'Mismatch error in chatState',
                    });
                }

                const shouldEnd = TEST_MODE
                    ? chatState >= questionsLength // if env.TEST_MODE !== 'off': we skip the final question
                    : chatState > questionsLength; // else: We answer the final question
                if (shouldEnd) {
                    log.info('Finished routine');
                    stop();
                    resolve({ success: true });
                }
            }
        });
    }

    static getInstance(userID: UserID) {
        return activeInstances.get(userID);
    }

    static instanceExists(userID: UserID) {
        return activeInstances.has(userID);
    }
}

type ChatState = QuestionType_ParkCar | QuestionType_RequestCar;

function isAlternativeMessage(
    msg: WAProto.IWebMessageInfo,
    chatState: ChatState,
) {
    return (
        chatState === QuestionType.REQUEST_TYPE_NEW &&
        msg.message?.conversation ===
            'מה מספר הטלפון שלך לצורכי זיהוי שרשומה במערכת'
    );
}

function isAgentGreeting(msg: WAProto.IWebMessageInfo) {
    const conv = msg.message?.conversation;
    return (
        typeof conv === 'string' &&
        conv.startsWith('היי') &&
        conv.endsWith('ואני אטפל בקריאתך.')
    );
}

function isGreetingImage(msg: WAProto.IWebMessageInfo, chatState: ChatState) {
    return isGreetingOrRequestType(chatState) && !!msg.message?.imageMessage;
}

function isNotificationTemplate(
    // TODO implement better when more info is available
    msg: WAProto.IWebMessageInfo,
    chatState: ChatState,
) {
    const res =
        isGreetingOrRequestType(chatState) &&
        //msg.type === 'notification_template' &&
        msg.messageStubType === WAMessageStubType.BIZ_PRIVACY_MODE_TO_FB;
    return res;
}

function isE2ENotification(
    // TODO implement when more info is available
    _msg: WAProto.IWebMessageInfo,
    _chatState: ChatState,
) {
    // return (
    //     isGreetingOrRequestType(chatState) && msg.messageStubType === WAMessageStubType.E2E_ENCRYPTED
    //     isGreetingOrRequestType(chatState) && msg.type === 'e2e_notification'
    // );
    return false;
}

function isGreetingOrRequestType(chatState: ChatState) {
    return (
        chatState === QuestionType.GREETING ||
        chatState === QuestionType.REQUEST_TYPE_NEW
    );
}
