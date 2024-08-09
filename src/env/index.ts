import { BitwardenSecrets } from './bitwarden';
import {
    type OptionalEnv,
    type RequiredEnv,
    optionalEnv,
    requiredEnv,
} from './env-list';

const bwSecrets = await BitwardenSecrets.new(
    process.env.BWS_ACCESS_TOKEN,
    process.env.BW_ORG_ID,
);
const secrets = {
    required: {} as Record<RequiredEnv, string>,
    optional: {} as Record<OptionalEnv, string | undefined>,
};

for (const envVar of requiredEnv) {
    const envVarValue = process.env[envVar] ?? (await bwSecrets.get(envVar));
    if (!envVarValue) {
        console.error(`Missing required secret: ${envVar}`);
        process.exit(1);
    }
    secrets.required[envVar] = envVarValue;
}

for (const envVar of optionalEnv) {
    const envVarValue = process.env[envVar] ?? (await bwSecrets.get(envVar));
    if (!envVarValue) {
        console.warn(`Missing optional secret: ${envVar}`);
    }
    secrets.optional[envVar] = envVarValue;
}

export default secrets;
