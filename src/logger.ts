import P from 'pino';

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
    s.replace(/(\p{Script=Hebrew}[^a-zA-Z\d]*\p{Script=Hebrew})/gu, match =>
        [...match].reverse().join(''),
    );
