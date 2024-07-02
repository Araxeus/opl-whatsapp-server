import type { User } from 'auth';
import { CarId, type QuestionsMap } from 'whatsapp/shared';
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
    REQUEST_TYPE = 2,
    NAME = 3,
    COMPANY_ID = 4,
    CAR_ID = 5,
    KM = 6,
    STARTING_POINT = 7,
    DESTINATION = 8,
    TIME = 9,
}

export const questions: QuestionsMap = {
    [QuestionType.GREETING]: 'שלום ותודה רבה שפנית לשירות הדיגיטל של אופרייט',
    [QuestionType.REQUEST_TYPE]: 'יש לבחור אחת מן האפשרויות הבאות:',
    [QuestionType.NAME]: 'נא להזין את שמך',
    [QuestionType.COMPANY_ID]: 'אנא הזן מספר עובד',
    [QuestionType.CAR_ID]: 'אנא הזן מספר רכב',
    [QuestionType.KM]: 'נא הזן ק"מ עדכני ברכב',
    [QuestionType.STARTING_POINT]: 'אנא הזן מקור נסיעה',
    [QuestionType.DESTINATION]: 'אנא הזן יעד נסיעה',
    [QuestionType.TIME]: 'נא להזין שעת נסיעה',
};

export type AnswerMapParkCar = (
    user: User,
    { carID, km, startingPoint, destination }: CarParkingInfo,
) => QuestionsMap;

export const answersMap: AnswerMapParkCar = (
    user,
    { carID, km, startingPoint, destination },
) => ({
    [QuestionType.GREETING]: 'אני עובד אופרייט',
    [QuestionType.REQUEST_TYPE]: 'לדיווח תנועה',
    [QuestionType.NAME]: user.name,
    [QuestionType.COMPANY_ID]: user.companyID.toString(),
    [QuestionType.CAR_ID]: carID,
    [QuestionType.KM]: km.toString(),
    [QuestionType.STARTING_POINT]: startingPoint,
    [QuestionType.DESTINATION]: destination,
    [QuestionType.TIME]: 'עכשיו',
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
