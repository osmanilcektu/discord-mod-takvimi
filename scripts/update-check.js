const pkg = require('../package.json');
const { compareVersions } = require('../src/utils/versionUtils');

const repository = process.env.GITHUB_REPOSITORY || 'osmanilcektu/discord-mod-takvimi';

async function main() {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': `discord-mod-takvimi/${pkg.version}`,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
    if (response.status === 404) {
        console.log(`Release bulunamadı. Mevcut sürüm: v${pkg.version}`);
        return;
    }
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
    const release = await response.json();
    const latest = release.tag_name || release.name;
    const update = compareVersions(latest, pkg.version) > 0;
    console.log(`Mevcut: v${pkg.version}`);
    console.log(`Son release: ${latest}`);
    console.log(update ? 'Güncelleme mevcut.' : 'Sürüm güncel.');
    console.log(release.html_url || `https://github.com/${repository}/releases`);
}

main().catch(error => {
    console.error(`Güncelleme kontrolü başarısız: ${error.message}`);
    process.exitCode = 1;
});
