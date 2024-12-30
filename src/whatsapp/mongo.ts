import {
    type AuthenticationCreds,
    BufferJSON,
    type SignalDataSet,
    type SignalDataTypeMap,
    type SignalKeyStore,
    WAProto,
    initAuthCreds,
} from '@whiskeysockets/baileys';
import { Schema, model } from 'mongoose';

export interface WhatsappSessionType {
    userID: string;
    data: string;
}

const whatsappSessionSchema = new Schema<WhatsappSessionType>({
    userID: {
        type: String,
        required: true,
        unique: true,
    },

    data: String,
});

const WhatsappSession = model<WhatsappSessionType>(
    'WhatsappSession',
    whatsappSessionSchema,
);

const getWhatsappSession = async (userID: string) =>
    await WhatsappSession.findOne({ userID });

export const getAuthFromDatabase = async (userID: string) => {
    let creds: AuthenticationCreds;
    let keys: SignalDataSet = {};
    const storedCreds = await getWhatsappSession(userID);
    if (storedCreds?.data) {
        const parsedCreds = JSON.parse(
            storedCreds.data,
            BufferJSON.reviver,
        ) as { creds: AuthenticationCreds; keys: SignalDataSet };
        creds = parsedCreds.creds;
        keys = parsedCreds.keys;
    } else {
        if (storedCreds === null)
            await new WhatsappSession({
                userID,
            }).save();
        creds = initAuthCreds();
    }

    const saveState = async () => {
        const data = JSON.stringify(
            {
                creds,
                keys,
            },
            BufferJSON.replacer,
            2,
        );
        await WhatsappSession.updateOne({ userID }, { data });
    };

    const clearState = async () => {
        await WhatsappSession.deleteOne({ userID });
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    return ids.reduce(
                        (dict, id) => {
                            let value = keys[type as keyof SignalDataSet]?.[id];
                            if (value) {
                                if (type === 'app-state-sync-key') {
                                    value =
                                        WAProto.Message.AppStateSyncKeyData.fromObject(
                                            value,
                                        );
                                }

                                dict[id] = value;
                            }

                            return dict;
                        },
                        {} as {
                            [
                                id: string
                            ]: SignalDataTypeMap[keyof SignalDataSet];
                        },
                    );
                },
                set: data => {
                    for (const type of Object.keys(
                        data,
                    ) as (keyof SignalDataSet)[]) {
                        keys[type] ??= {};
                        if (!data[type]) {
                            delete keys[type];
                        } else {
                            Object.assign(
                                keys[type], //as SignalDataSet,
                                data[type],
                            );
                        }
                    }
                    void saveState();
                },
            } as SignalKeyStore,
        },
        saveState,
        clearState,
    };
};
