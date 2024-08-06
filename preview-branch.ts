import { $ } from 'bun';

const ENV = {
    COOLIFY_URL: 'https://cool.karearl.com',
    API_TOKEN: '1|4mEEdbJ3dX32D69TblRSHK8SUJqcgslI7S5IXtTa472a931a',
    PR_PREVIEW_UUID: 'dwso88s',
    PROJECT_UUID: 'kswg8ks',
};

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
    }),
});

if (patchRes.ok && patchRes.status === 200) {
    console.log(`Set preview branch to ${currentBranch}
Access it at:
https://opl-pr-preview.karearl.com`);
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
        const deployUrl = `${ENV.COOLIFY_URL}/project/${ENV.PROJECT_UUID}/pr-preview/application/${ENV.PR_PREVIEW_UUID}/deployment/${deployment_uuid}`;
        console.log(`Deployment started, check its progress at:\n${deployUrl}`);
    } else {
        console.error('Failed to deploy');
        console.error(await deployRes.text());
    }
}
