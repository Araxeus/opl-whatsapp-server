import P from 'pino';

// const dateFormatIsrael = new Intl.DateTimeFormat('en-US', {
//     timeZone: 'Asia/Jerusalem',
//     month: 'short',
//     day: 'numeric',
//     year: 'numeric',
//     hour: 'numeric',
//     minute: 'numeric',
//     second: 'numeric',
//     timeZoneName: 'short',
//     // dateStyle: 'medium',
//     // timeStyle: 'long', // both cant be used because of fractionalSecondDigits
//     fractionalSecondDigits: 3,
//     hourCycle: 'h24',
// });

export const ilTime = () =>
    new Date(
        new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Jerusalem',
        }),
    );

export default P({
    timestamp: () => `,"time":"${ilTime()}"`,
    transport: {
        target: 'pino-pretty',
    },
});

export const rtlC = (s: string) =>
    s.replace(/(\p{Script=Hebrew}[^a-zA-Z\d]*\p{Script=Hebrew})/gu, (match) =>
        [...match].reverse().join(''),
    );
