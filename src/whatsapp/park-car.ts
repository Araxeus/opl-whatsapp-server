import type { User } from 'auth';
import {
    CarId,
    type Question,
    buttonSelector,
    buttonTitleSelector,
    listMessageDescriptionSelector,
} from 'whatsapp/shared';
import { z } from 'zod';

export const CarParkingInfoSchema = z.object({
    carID: CarId,
    km: z.number(),
    startingPoint: z.string(),
    destination: z.string(),
});

export type CarParkingInfo = z.infer<typeof CarParkingInfoSchema>;

export enum QuestionType {
    GREETING = 1,
    REQUEST_TYPE_NEW = 2,
    REQUEST_TYPE = 3,
    NAME = 4,
    COMPANY_ID = 5,
    CAR_ID = 6,
    KM = 7,
    TIME = 8,
    STARTING_POINT = 9,
    REQUEST_SPECIFIC_TYPE = 10,
    DESTINATION = 11,
}

export const questions = (
    user: User,
    { carID, km, startingPoint, destination }: CarParkingInfo,
): { [keyof in QuestionType]: Question } => ({
    [QuestionType.GREETING]: {
        question: 'שלום ותודה רבה שפנית לשירות הדיגיטל של אופרייט',
        answer: 'אני עובד אופרייט',
        selector: buttonTitleSelector,
    },
    [QuestionType.REQUEST_TYPE_NEW]: {
        question: 'יש לבחור אחת מן האפשרויות הבאות:',
        answer: 'מחלקת שינוע',
        selector: listMessageDescriptionSelector,
    },
    [QuestionType.REQUEST_TYPE]: {
        question: 'יש לבחור אחת מן האפשרויות הבאות:',
        answer: 'לדיווח תנועה',
        selector: listMessageDescriptionSelector,
    },
    [QuestionType.NAME]: {
        question: 'נא להזין את שמך',
        answer: user.name,
    },
    [QuestionType.COMPANY_ID]: {
        question: `${user.name}, אנא הזן מספר עובד`,
        answer: user.companyID,
    },
    [QuestionType.CAR_ID]: {
        question: 'אנא הזן מספר רכב',
        answer: carID,
    },
    [QuestionType.KM]: {
        question: 'נא הזן ק"מ עדכני ברכב',
        answer: km.toString(),
    },
    [QuestionType.TIME]: {
        question: 'נא להזין שעת נסיעה',
        answer: 'עכשיו',
    },
    [QuestionType.STARTING_POINT]: {
        question: 'אנא הזן מקור נסיעה',
        answer: startingPoint,
    },
    [QuestionType.REQUEST_SPECIFIC_TYPE]: {
        question: 'נא לבחור את סוג הדיווח:',
        answer: 'חנייה',
        selector: buttonSelector,
    },
    [QuestionType.DESTINATION]: {
        question: 'אנא הזן יעד נסיעה',
        answer: destination,
    },
});

export const customAnswerParkCar = (
    user: User,
    { carID, km, startingPoint, destination }: CarParkingInfo,
) => `דיווח חנייה:
${carID}
מקור: ${startingPoint}
יעד: ${destination}
ק"מ: ${km}
${user.name} ${user.companyID}`;
