import type { User } from 'auth';
import { CarId, type QuestionsMap } from 'whatsapp/shared';
import { z } from 'zod';

export const ReplaceClientCarSchema = z.object({
    clientCarID: CarId,
    replacementCarID: CarId,
    replacementCarKM: z.number().optional(),
});

export type ReplaceClientCarInfo = z.infer<typeof ReplaceClientCarSchema>;

export enum QuestionType {
    GREETING = 1,
    REQUEST_TYPE = 2,
    NAME = 3,
    COMPANY_ID = 4,
    DATE = 5,
    TIME = 6,
    clientCarID = 7,
    replacementCarID = 8,
    replacementCarKM = 9,
}

export const questions: QuestionsMap = {
    [QuestionType.GREETING]: 'שלום ותודה רבה שפנית לשירות הדיגיטל של אופרייט',
    [QuestionType.REQUEST_TYPE]: 'יש לבחור אחת מן האפשרויות הבאות:',
    [QuestionType.NAME]: 'נא להזין את שמך',
    [QuestionType.COMPANY_ID]: 'אנא הזן מספר עובד',
    [QuestionType.DATE]: 'אנא הזן את תאריך מסירת הרכב החלופי',
    [QuestionType.TIME]: 'אנא הזן את שעת מסירת הרכב החלופי ללקוח',
    [QuestionType.clientCarID]: 'אנא הזן מספר רכב מקורי',
    [QuestionType.replacementCarID]: 'אנא הזן מספר רכב חלופי',
    [QuestionType.replacementCarKM]: 'אנא עדכן ק"מ עדכני ברכב החלופי',
};

export type AnswerMapReplaceClientCar = (
    user: User,
    { clientCarID, replacementCarID, replacementCarKM }: ReplaceClientCarInfo,
) => QuestionsMap;

export const answersMap: AnswerMapReplaceClientCar = (
    user,
    { clientCarID, replacementCarID, replacementCarKM },
) => ({
    [QuestionType.GREETING]: 'אני עובד אופרייט',
    [QuestionType.REQUEST_TYPE]: 'מסירת רכב חלופי',
    [QuestionType.NAME]: user.name,
    [QuestionType.COMPANY_ID]: user.companyID.toString(),
    [QuestionType.DATE]: 'היום',
    [QuestionType.TIME]: 'עכשיו',
    [QuestionType.clientCarID]: clientCarID,
    [QuestionType.replacementCarID]: replacementCarID,
    [QuestionType.replacementCarKM]: replacementCarKM?.toString() || 'אחרון',
});

export const customAnswerReplaceClientCar = (
    user: User,
    { clientCarID, replacementCarID }: ReplaceClientCarInfo,
) => `אני צריך בבקשה לפתוח רכב חליפי:
מקורי: ${clientCarID}
חליפי: ${replacementCarID}
${user.name} ${user.companyID}`;
