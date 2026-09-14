const fs = require('fs');
const readline = require('readline');
const { parseTimeRange } = require('./utils/dateTime');
const packageJson = require('../package.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt, { hidden = false } = {}) {
    if (!hidden) return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));

    return new Promise(resolve => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        stdout.write(prompt);
        const onData = char => {
            char = char.toString();
            if (char === '\n' || char === '\r' || char === '\u0004') {
                stdin.removeListener('data', onData);
                stdout.write('\n');
                resolve(buffer.trim());
                return;
            }
            if (char === '\u0003') process.exit(130);
            if (char === '\u007f') {
                buffer = buffer.slice(0, -1);
                return;
            }
            buffer += char;
        };
        let buffer = '';
        stdin.on('data', onData);
    });
}

function yes(value, fallback = false) {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return fallback;
    return ['y', 'yes', 'e', 'evet'].includes(normalized);
}

function requireSnowflake(value, label) {
    if (!/^\d{16,22}$/.test(value)) throw new Error(`${label} geçerli bir Discord ID değil.`);
    return value;
}

function positiveInt(value, fallback, min, max, label) {
    const parsed = value === '' ? fallback : Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new Error(`${label} ${min}-${max} aralığında tam sayı olmalıdır.`);
    }
    return parsed;
}

function validateSlots(slots) {
    if (!Array.isArray(slots) || slots.length !== 5) throw new Error('Tam 5 vardiya tanımlanmalıdır.');
    for (const slot of slots) {
        if (!parseTimeRange(slot)) throw new Error(`Geçersiz vardiya aralığı: ${slot}`);
    }
    return slots;
}

async function setup() {
    console.log(`Discord Moderatör Takvim Botu v${packageJson.version} - Kurulum\n`);

    try {
        for (const dir of ['data', 'logs', 'temp']) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync('.env')) {
            const overwrite = await question('.env zaten mevcut. Üzerine yazılsın mı? (y/N): ');
            if (!yes(overwrite, false)) {
                console.log('Kurulum iptal edildi.');
                return;
            }
            fs.copyFileSync('.env', `.env.backup-${Date.now()}`);
            console.log('Mevcut .env yedeklendi.');
        }

        const token = await question('Discord Bot Token: ');
        if (!token || token.length < 30) throw new Error('Discord Bot Token boş veya geçersiz görünüyor.');

        const guildId = requireSnowflake(await question('Discord Sunucu (Guild) ID: '), 'GUILD_ID');
        const adminId = requireSnowflake(await question('Admin kanal ID: '), 'ADMIN_MOD_CHANNEL_ID');

        const logRaw = await question('Log kanal ID (boş = admin kanalı): ');
        const scheduleRaw = await question('Takvim kanal ID (boş = admin kanalı): ');
        const modScheduleRaw = await question('Mod takvim kanal ID (boş = takvim/admin): ');
        const logId = logRaw ? requireSnowflake(logRaw, 'LOG_CHANNEL_ID') : adminId;
        const scheduleId = scheduleRaw ? requireSnowflake(scheduleRaw, 'SCHEDULE_CHANNEL_ID') : adminId;
        const modScheduleId = modScheduleRaw ? requireSnowflake(modScheduleRaw, 'MOD_SCHEDULE_CHANNEL_ID') : scheduleId;

        const roles = (await question('Moderatör rolleri [MOD,SR MOD,HEAD MOD]: ')) || 'MOD,SR MOD,HEAD MOD';
        const dailyHour = positiveInt(await question('Günlük anket başlatma saati [8]: '), 8, 0, 23, 'DAILY_SCHEDULE_HOUR');
        const timeoutHours = positiveInt(await question('Günlük anket yanıt süresi, saat [5]: '), 5, 1, 24, 'SURVEY_TIMEOUT_HOURS');
        const timezone = (await question('Saat dilimi [Europe/Istanbul]: ')) || 'Europe/Istanbul';
        try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); } catch { throw new Error('TIMEZONE geçersiz.'); }

        const defaultSlots = ['00:00-05:00', '05:00-10:00', '10:00-15:00', '15:00-20:00', '20:00-24:00'];
        const customSlots = await question('Özel 5 vardiya JSON kullanılsın mı? (y/N): ');
        let slots = defaultSlots;
        if (yes(customSlots, false)) {
            const raw = await question('TIME_SLOTS JSON: ');
            slots = validateSlots(JSON.parse(raw));
        }

        const envContent = `# Discord\nDISCORD_TOKEN=${token}\nGUILD_ID=${guildId}\nADMIN_MOD_CHANNEL_ID=${adminId}\nLOG_CHANNEL_ID=${logId}\nSCHEDULE_CHANNEL_ID=${scheduleId}\nMOD_SCHEDULE_CHANNEL_ID=${modScheduleId}\nMOD_ROLES=${roles}\n\n# Otomatik günlük planlama\nAUTO_SCHEDULE_ENABLED=false\nDAILY_SCHEDULE_HOUR=${dailyHour}\nSURVEY_TIMEOUT_HOURS=${timeoutHours}\nTIMEZONE=${timezone}\n\n# Manuel haftalık anket (admin/takvim-gonder)\nRESPONSE_TIMEOUT_HOURS=24\n# Planlama cezası\nFIRST_VIOLATION_DAYS=2\nSECOND_VIOLATION_HOURS=1\nTHIRD_VIOLATION_DAYS=1\n\n# Tam 5 vardiya\nTIME_SLOTS=${JSON.stringify(slots)}\n\n# Veri ve log\nDATABASE_PATH=./data/bot.db\nLOG_LEVEL=info\n\n# Proje izleme / güncelleme\nGITHUB_REPOSITORY=osmanilcektu/discord-mod-takvimi\nUPDATE_CHECK_ENABLED=true\nUPDATE_CHECK_INTERVAL_HOURS=6\nUPDATE_CHANNEL_ID=${logId}\nREPORTING_ENABLED=false\nSTARTUP_REPORT_ENABLED=false\nDAILY_REPORT_ENABLED=false\nDAILY_REPORT_HOUR=9\nREPORT_CHANNEL_ID=${logId}\n`;

        fs.writeFileSync('.env', envContent, { mode: 0o600 });
        console.log('\nKurulum tamamlandı.');
        console.log('1. Discord Developer Portal > Bot > Server Members Intent seçeneğini açın.');
        console.log('2. npm run verify');
        console.log('3. npm audit');
        console.log('4. npm run doctor');
        console.log('5. npm start');
    } catch (error) {
        console.error(`Kurulum hatası: ${error.message}`);
        process.exitCode = 1;
    } finally {
        rl.close();
    }
}

async function testSetup() {
    try {
        const config = require('./utils/config');
        config.assertValid();
        const Database = require('./database/database');
        const db = new Database(config.database.path, config.timeSlots);
        await db.connect();
        await db.init();
        await db.close();
        console.log('Konfigürasyon ve veritabanı testi başarılı.');
    } catch (error) {
        console.error(`Test başarısız: ${error.message}`);
        process.exitCode = 1;
    } finally {
        rl.close();
    }
}

if (process.argv.includes('--test')) testSetup();
else setup();
