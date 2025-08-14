import type { User } from 'auth';
import {
    buttonSelector,
    buttonTitleSelector,
    CarId,
    listMessageDescriptionSelector,
    type Question,
} from 'whatsapp/shared';
import { z } from 'zod';

export const ReplaceClientCarSchema = z.object({
    clientCarID: CarId,
    replacementCarID: CarId,
    nameOfClientCompany: z.string(),
    replacementCarOrigin: z.string().optional(),
});

export type ReplaceClientCarInfo = z.infer<typeof ReplaceClientCarSchema>;

export enum QuestionType {
    GREETING = 1,
    REQUEST_TYPE_NEW = 2,
    REQUEST_TYPE = 3,
    REQUEST_SPECIFIC_TYPE = 4,
    NAME = 5,
    COMPANY_ID = 6,
    replacementCarID = 7,
    replacementCarOrigin = 8,
    clientCarID = 9,
    nameOfClientCompany = 10,
}

export const questions = (
    user: User,
    {
        clientCarID,
        replacementCarID,
        nameOfClientCompany,
        replacementCarOrigin,
    }: ReplaceClientCarInfo,
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
        answer: user.companyID,
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
    [QuestionType.nameOfClientCompany]: {
        question: 'אנא הזן שם חברה (לקוח)',
        answer: nameOfClientCompany,
    },
});

export const customAnswerReplaceClientCar = (
    user: User,
    { clientCarID, replacementCarID }: ReplaceClientCarInfo,
) => `אני צריך בבקשה לפתוח רכב חליפי:
מקורי: ${clientCarID}
חליפי: ${replacementCarID}
${user.name} ${user.companyID}`;
