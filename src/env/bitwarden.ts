import { BitwardenClient } from '@bitwarden/sdk-napi';
import {
    type BWSecrets,
    type OptionalEnv,
    type RequiredEnv,
    optionalEnv,
    requiredEnv,
} from './env-list';

export class BitwardenSecrets {
    private client?: BitwardenClient;
    private secretsIdMap: BWSecrets = {};

    private constructor(
        private token?: string,
        private orgId?: string,
    ) {
        if (!token) return;
        if (!orgId) {
            console.error('Missing required secret: BW_ORG_ID');
            return;
        }
        this.client = new BitwardenClient();
    }

    static async new(token?: string, orgId?: string) {
        const bw = new BitwardenSecrets(token, orgId);
        await bw.init();
        return bw;
    }

    private async init() {
        if (!this.client || !this.token || !this.orgId) return;
        await this.client.loginWithAccessToken(this.token).then((result) => {
            if (!result.success) {
                throw Error(
                    `BitWarden Authentication failed, error: ${result.errorMessage}`,
                );
            }
        });
        const secrets = await this.client.secrets().list(this.orgId);
        if (!secrets.success || !secrets.data?.data) {
            throw Error(
                `Failed to list Bitwarden secrets, error: ${secrets.errorMessage}`,
            );
        }
        const secretsData = secrets.data.data.filter(
            ({ key }) =>
                requiredEnv.includes(key as RequiredEnv) ||
                optionalEnv.includes(key as OptionalEnv),
        );
        this.secretsIdMap = (await Promise.all(secretsData)).reduce(
            (acc, secret) => {
                if (secret) {
                    acc[secret.key as OptionalEnv | RequiredEnv] = secret.id;
                }
                return acc;
            },
            {} as BWSecrets,
        );
    }

    async get(key: OptionalEnv | RequiredEnv): Promise<string | undefined> {
        if (!this.client) return;
        const secretId = this.secretsIdMap[key];
        if (!secretId) return;
        const secret = await this.client.secrets().get(secretId);
        return secret?.data?.value;
    }
}
