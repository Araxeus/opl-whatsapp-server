import type { WAProto } from '@whiskeysockets/baileys';
import type { CarParkingInfo } from 'whatsapp/park-car';
import type { ReplaceClientCarInfo } from 'whatsapp/replace-client-car';
import { z } from 'zod';

// Check if carId is in the format 398-35-902 or 39853902
export const CarId = z
    .string()
    .refine((val) => /^\d{3}-?\d{2}-?\d{3}$/.test(val), {
        message: 'carId must be in the format 398-35-902 or 39853902',
    });

if (!process.env.OPERATE_PHONE_NUMBER) {
    throw new Error('env.OPERATE_PHONE_NUMBER must be defined');
}
export const OPERATE_PHONE_NUMBER = process.env.OPERATE_PHONE_NUMBER;

export function isCarParkingInfo(
    data: CarParkingInfo | ReplaceClientCarInfo,
): data is CarParkingInfo {
    return (data as CarParkingInfo).carID !== undefined;
}

export interface Question {
    question: string;
    answer: string;
    selector?: (msg: WAProto.IWebMessageInfo) => string | null | undefined;
}

export interface QuestionsMap {
    '1': Question;
    '2': Question;
    [x: number]: Question;
}

export const buttonSelector = (msg: WAProto.IWebMessageInfo) =>
    msg.message?.buttonsMessage?.contentText;
