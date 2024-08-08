import { $ } from 'bun';

const ENV = {
    COOLIFY_URL: process.env.COOLIFY_URL,
    PR_PREVIEW_URL: process.env.COOLIFY_PR_PREVIEW_URL,
    API_TOKEN: process.env.COOLIFY_API_TOKEN,
    PR_PREVIEW_UUID: process.env.COOLIFY_PR_PREVIEW_UUID,
    PROJECT_UUID: process.env.COOLIFY_PROJECT_UUID,
    PROJECT_NAME: 'pr-preview',
};

for (const key in ENV) {
    if (!ENV[key as keyof typeof ENV]) {
        console.error(`Missing environment variable: ${key}`);
        process.exit(1);
    }
}

const currentBranch = await $`git branch --show-current`.text();

const appUrl = `${ENV.COOLIFY_URL}/api/v1/applications/${ENV.PR_PREVIEW_UUID}`;
const auth = { Authorization: `Bearer ${ENV.API_TOKEN}` };

const patchRes = await fetch(appUrl, {
    method: 'PATCH',
    headers: {
        ...auth,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        git_branch: currentBranch,
        domains: ENV.PR_PREVIEW_URL,
    }),
});

if (patchRes.ok && patchRes.status === 200) {
    console.log(`Set preview branch to ${currentBranch}
Access it at:
${ENV.PR_PREVIEW_URL}`);
    await deploy();
} else {
    console.error('Failed to set preview branch');
    console.error(await patchRes.text());
}

async function deploy() {
    const deployRes = await fetch(`${appUrl}/start?force=true`, {
        method: 'POST',
        headers: auth,
    });

    if (deployRes.ok && deployRes.status === 200) {
        const { deployment_uuid } = await deployRes.json();
        const deployUrl = `${ENV.COOLIFY_URL}/project/${ENV.PROJECT_UUID}/${ENV.PROJECT_NAME}/application/${ENV.PR_PREVIEW_UUID}/deployment/${deployment_uuid}`;
        console.log(`Deployment started, check its progress at:\n${deployUrl}`);
    } else {
        console.error('Failed to deploy');
        console.error(await deployRes.text());
    }
}
