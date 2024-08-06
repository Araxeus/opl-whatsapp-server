const optionalEnv = ['TEST_USERID', 'TEST_MODE', 'HOST', 'PORT'] as const;
const requiredEnv = [
    'MONGODB_URI',
    'USERID_SECRET',
    'OPENAI_API_KEY',
    'REFRESH_KEY',
    'OPERATE_PHONE_NUMBER',
] as const;

export default {
    required: requiredEnv.reduce(
        (acc, envVar) => {
            const envVarValue = process.env[envVar]; // || bitwardensecrets[envVar];
            if (!envVarValue) {
                console.error(`Missing required secret: ${envVar}`);
                process.exit(1);
            }
            acc[envVar] = envVarValue;
            return acc;
        },
        {} as Record<(typeof requiredEnv)[number], string>,
    ),
    optional: optionalEnv.reduce(
        (acc, envVar) => {
            const envVarValue = process.env[envVar]; // || bitwardensecrets[envVar];
            if (!envVarValue) {
                console.warn(`Missing optional secret: ${envVar}`);
            }
            acc[envVar] = envVarValue;
            return acc;
        },
        {} as Record<(typeof optionalEnv)[number], string | undefined>,
    ),
};

// we have already defined BWS_ACCESS_TOKEN globally on Araxeus-PC

// https://github.com/bitwarden/sdk/blob/main/languages/js/example/index.js
// https://www.npmjs.com/package/@bitwarden/sdk-napi
// https://www.npmjs.com/package/@bitwarden/sdk-wasm
// https://bitwarden.com/help/secrets-manager-sdk/
// https://bitwarden.com/help/github-actions-integration/
// https://vault.bitwarden.com/#/sm
// https://bitwarden.com/help/secret-decryption/
