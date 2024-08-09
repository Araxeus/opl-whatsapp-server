export const optionalEnv = [
    'TEST_USERID',
    'TEST_MODE',
    'HOST',
    'PORT',
] as const;
export type OptionalEnv = (typeof optionalEnv)[number];
export const requiredEnv = [
    'MONGODB_URI',
    'USERID_SECRET',
    'OPENAI_API_KEY',
    'REFRESH_KEY',
    'OPERATE_PHONE_NUMBER',
] as const;
export type RequiredEnv = (typeof requiredEnv)[number];
export type BWSecrets = Partial<Record<OptionalEnv | RequiredEnv, string>>;
