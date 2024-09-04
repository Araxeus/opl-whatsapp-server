import type { User } from 'auth';
import {
    CarId,
    type Question,
    buttonSelector,
    listMessageDescriptionSelector,
    listMessageTitleSelector,
} from 'whatsapp/shared';
import { z } from 'zod';

export const ReplaceClientCarSchema = z.object({
    clientCarID: CarId,
    replacementCarID: CarId,
    replacementCarKM: z.number().optional(),
    replacementCarOrigin: z.string().optional(),
});

export type ReplaceClientCarInfo = z.infer<typeof ReplaceClientCarSchema>;

export enum QuestionType {
    GREETING = 1,
    REQUEST_TYPE = 2,
    REQUEST_SPECIFIC_TYPE = 3,
    NAME = 4,
    COMPANY_ID = 5,
    replacementCarID = 6,
    replacementCarOrigin = 7,
    clientCarID = 8,
    replacementCarKM = 9,
    nameCheck = 10,
}

export const questions = (
    user: User,
    {
        clientCarID,
        replacementCarID,
        replacementCarKM,
        replacementCarOrigin,
    }: ReplaceClientCarInfo,
): { [keyof in QuestionType]: Question } => ({
    [QuestionType.GREETING]: {
        question: 'שלום ותודה רבה שפנית לשירות הדיגיטל של אופרייט',
        answer: 'אני עובד אופרייט',
        selector: listMessageTitleSelector,
    },
    [QuestionType.REQUEST_TYPE]: {
        question: 'יש לבחור אחת מן האפשרויות הבאות:',
        answer: 'מסירת / החזרת חלופי',
        selector: listMessageDescriptionSelector,
    },
    [QuestionType.REQUEST_SPECIFIC_TYPE]: {
        question: 'נא לבחור את סוג הדיווח:',
        answer: 'מסירת רכב חלופי',
        selector: buttonSelector,
    },
    [QuestionType.NAME]: {
        question: 'נא להזין את שמך',
        answer: user.name,
    },
    [QuestionType.COMPANY_ID]: {
        question: `${user.name}, אנא הזן מספר עובד`,
        answer: user.companyID.toString(),
    },
    [QuestionType.replacementCarID]: {
        question: 'אנא הזן מספר רכב חלופי',
        answer: replacementCarID,
    },
    [QuestionType.replacementCarOrigin]: {
        question: 'אנא הזן מקור נסיעה',
        answer: replacementCarOrigin || 'חנייה',
    },
    [QuestionType.clientCarID]: {
        question: 'אנא הזן מספר רכב מקורי',
        answer: clientCarID,
    },
    [QuestionType.replacementCarKM]: {
        question: 'אנא עדכן ק"מ עדכני ברכב החלופי',
        answer: replacementCarKM?.toString() || 'אחרון',
    },
    [QuestionType.nameCheck]: {
        question: `האם שמך הוא ${user.name}?`,
        answer: 'כן',
        selector: buttonSelector,
    },
});

export const customAnswerReplaceClientCar = (
    user: User,
    { clientCarID, replacementCarID }: ReplaceClientCarInfo,
) => `אני צריך בבקשה לפתוח רכב חליפי:
מקורי: ${clientCarID}
חליפי: ${replacementCarID}
${user.name} ${user.companyID}`;
