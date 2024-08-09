import { BitwardenClient } from '@bitwarden/sdk-napi';

const optionalEnv = ['TEST_USERID', 'TEST_MODE', 'HOST', 'PORT'] as const;
type OptionalEnv = (typeof optionalEnv)[number];
const requiredEnv = [
    'MONGODB_URI',
    'USERID_SECRET',
    'OPENAI_API_KEY',
    'REFRESH_KEY',
    'OPERATE_PHONE_NUMBER',
] as const;
type RequiredEnv = (typeof requiredEnv)[number];
type BWSecrets = Partial<Record<OptionalEnv | RequiredEnv, string>>;

const bwSecrets: BWSecrets = await getBwSecrets(
    process.env.BWS_ACCESS_TOKEN,
    process.env.BW_ORG_ID,
);

export default {
    required: requiredEnv.reduce(
        (acc, envVar) => {
            const envVarValue = process.env[envVar] ?? bwSecrets[envVar];
            if (!envVarValue) {
                console.error(`Missing required secret: ${envVar}`);
                process.exit(1);
            }
            acc[envVar] = envVarValue;
            return acc;
        },
        {} as Record<RequiredEnv, string>,
    ),
    optional: optionalEnv.reduce(
        (acc, envVar) => {
            const envVarValue = process.env[envVar] ?? bwSecrets[envVar];
            if (!envVarValue) {
                console.warn(`Missing optional secret: ${envVar}`);
            }
            acc[envVar] = envVarValue;
            return acc;
        },
        {} as Record<OptionalEnv, string | undefined>,
    ),
};

async function getBwSecrets(
    token: string | undefined,
    orgId: string | undefined,
): Promise<BWSecrets> {
    if (!token) return {};
    if (!orgId) {
        console.error('Missing required secret: BW_ORG_ID');
        return {};
    }

    const client = new BitwardenClient();

    const result = await client.loginWithAccessToken(token);
    if (!result.success) {
        throw Error(
            `BitWarden Authentication failed, error: ${result.errorMessage}`,
        );
    }

    const secrets = await client.secrets().list(orgId);
    if (!secrets.success || !secrets.data?.data) {
        throw Error(
            `Failed to list Bitwarden secrets, error: ${secrets.errorMessage}`,
        );
    }
    const secretsData = secrets.data.data
        .filter(
            ({ key }) =>
                requiredEnv.includes(key as RequiredEnv) ||
                optionalEnv.includes(key as OptionalEnv),
        )
        .map(({ id }) =>
            client
                .secrets()
                .get(id)
                .then(({ data }) =>
                    data ? { key: data.key, value: data.value } : undefined,
                ),
        );
    return (await Promise.all(secretsData)).reduce(
        (acc, secret) => {
            if (secret) {
                acc[secret.key as OptionalEnv | RequiredEnv] = secret.value;
            }
            return acc;
        },
        {} as Record<OptionalEnv | RequiredEnv, string>,
    );
}

// https://github.com/bitwarden/sdk/blob/main/languages/js/example/index.js
// https://www.npmjs.com/package/@bitwarden/sdk-napi
// https://www.npmjs.com/package/@bitwarden/sdk-wasm
// https://bitwarden.com/help/secrets-manager-sdk/
// https://bitwarden.com/help/github-actions-integration/
// https://vault.bitwarden.com/#/sm
// https://bitwarden.com/help/secret-decryption/
