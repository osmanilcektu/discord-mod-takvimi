const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['src', 'scripts', 'test'];
const failures = [];

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'data', 'logs', 'temp'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walk(full));
        else result.push(full);
    }
    return result;
}

function fail(message) {
    failures.push(message);
    console.error(`FAIL: ${message}`);
}

function normalizedRelative(file) {
    return path.relative(root, file).replace(/\\/g, '/');
}

function getTrackedFiles() {
    const gitDir = path.join(root, '.git');
    if (!fs.existsSync(gitDir)) return null;
    const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
        fail(`git ls-files çalıştırılamadı: ${(result.stderr || '').trim()}`);
        return [];
    }
    return result.stdout.split('\0').filter(Boolean).map(rel => path.join(root, rel)).filter(fs.existsSync);
}

console.log('1/5 package.json kontrolü');
try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!pkg.scripts?.start || !pkg.scripts?.test || !pkg.scripts?.check) fail('Gerekli npm scriptleri eksik.');
    if (pkg.engines?.node !== '>=20.17.0') fail('Node.js engine >=20.17.0 olmalı.');
} catch (error) {
    fail(`package.json okunamadı: ${error.message}`);
}

console.log('2/5 JavaScript sözdizimi kontrolü');
const jsFiles = sourceRoots.flatMap(dir => walk(path.join(root, dir))).filter(file => file.endsWith('.js'));
for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) fail(`${normalizedRelative(file)}: ${(result.stderr || result.stdout).trim()}`);
}

console.log('3/5 Veritabanı API referans kontrolü');
const databaseFile = path.join(root, 'src', 'database', 'database.js');
const databaseText = fs.readFileSync(databaseFile, 'utf8');
const definedMethods = new Set([...databaseText.matchAll(/^\s+async\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match => match[1]));
for (const file of walk(path.join(root, 'src')).filter(file => file.endsWith('.js') && file !== databaseFile)) {
    const text = fs.readFileSync(file, 'utf8');
    const calls = [...text.matchAll(/(?:client|this)\.database\.([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]);
    for (const method of calls) if (!definedMethods.has(method)) fail(`${normalizedRelative(file)} bilinmeyen database metodu çağırıyor: ${method}`);
}

console.log('4/5 Gizli bilgi / çalışma dosyası kontrolü');
const gitignoreFile = path.join(root, '.gitignore');
if (!fs.existsSync(gitignoreFile)) fail('.gitignore bulunamadı.');
else {
    const gitignore = fs.readFileSync(gitignoreFile, 'utf8');
    for (const pattern of ['.env', 'node_modules/', 'data/', 'logs/', '*.db']) {
        if (!gitignore.includes(pattern)) fail(`.gitignore eksik kural içeriyor: ${pattern}`);
    }
}

const trackedFiles = getTrackedFiles();
let filesToScan;
if (trackedFiles) {
    filesToScan = trackedFiles;
    for (const file of trackedFiles) {
        const rel = normalizedRelative(file);
        const base = path.basename(file);
        if (base === '.env' || /\.(db|sqlite|sqlite3)$/i.test(base)) fail(`Git tarafından takip edilen runtime/gizli dosya bulundu: ${rel}`);
    }
} else {
    filesToScan = walk(root).filter(file => {
        const rel = normalizedRelative(file);
        const base = path.basename(file);
        if (base === '.env' || /^\.env\..+$/i.test(base)) return false;
        if (/\.(db|sqlite|sqlite3)$/i.test(base)) return false;
        if (rel.startsWith('data/') || rel.startsWith('logs/') || rel.startsWith('temp/')) return false;
        return true;
    });
}

const tokenPattern = /\b[A-Za-z0-9_-]{20,32}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{20,64}\b/g;
const envTokenPattern = /DISCORD_TOKEN\s*=\s*([^\s#]+)/g;
for (const file of filesToScan) {
    const base = path.basename(file);
    if (!/\.(js|json|md|yml|yaml|env|txt|gitignore)$/i.test(file) && base !== '.gitignore' && base !== 'LICENSE') continue;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (tokenPattern.test(text)) {
        fail(`Olası Discord tokenı bulundu: ${normalizedRelative(file)}`);
    }
    tokenPattern.lastIndex = 0;

    for (const match of text.matchAll(envTokenPattern)) {
        const value = String(match[1] || '').trim();
        if (
            value &&
            value !== 'your_bot_token_here' &&
            !value.startsWith('${') &&
            value.length >= 20
        ) {
            fail(`Olası DISCORD_TOKEN değeri bulundu: ${normalizedRelative(file)}`);
        }
    }
    envTokenPattern.lastIndex = 0;
}

console.log('5/5 Zorunlu proje dosyaları kontrolü');
for (const rel of ['README.md', 'INSTALL.md', 'TROUBLESHOOTING.md', 'UPGRADE-v2.2.1.md', 'LICENSE', 'PRIVACY.md', 'TERMS.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'config.example.env', '.github/workflows/node-ci.yml', '.github/workflows/release.yml', '.github/dependabot.yml', 'Dockerfile', '.dockerignore', 'docker-compose.yml']) {
    if (!fs.existsSync(path.join(root, rel))) fail(`Eksik dosya: ${rel}`);
}

if (failures.length > 0) {
    console.error(`\n${failures.length} kontrol başarısız.`);
    process.exit(1);
}
console.log(`\nTüm statik kontroller başarılı. ${jsFiles.length} JavaScript dosyası doğrulandı.`);
