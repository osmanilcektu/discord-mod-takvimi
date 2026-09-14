const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./utils/config');
const Database = require('./database/database');
const Logger = require('./utils/logger');
const PermissionChecker = require('./utils/permissionChecker');
const ProjectMonitor = require('./utils/projectMonitor');

async function main() {
    const logger = new Logger('warn');
    const database = new Database(config.database.path, config.timeSlots);
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    client.config = config;
    client.database = database;
    client.logger = logger;

    let failed = false;
    const ok = message => console.log(`OK   ${message}`);
    const bad = message => { failed = true; console.error(`FAIL ${message}`); };
    const warn = message => console.warn(`WARN ${message}`);

    try {
        config.assertValid();
        ok('Konfigürasyon biçimi geçerli.');

        await database.connect();
        await database.init();
        await database.getActiveModerators();
        ok('SQLite bağlantısı ve şema sağlıklı.');

        await client.login(config.discord.token);
        await new Promise((resolve, reject) => {
            if (client.isReady()) return resolve();
            const timeout = setTimeout(() => reject(new Error('Discord hazır olma zaman aşımı.')), 15000);
            client.once(Events.ClientReady, () => { clearTimeout(timeout); resolve(); });
        });
        ok(`Discord bağlantısı: ${client.user.tag}`);

        const guild = client.guilds.cache.get(config.discord.guildId)
            || await client.guilds.fetch(config.discord.guildId).catch(() => null);
        if (!guild) throw new Error('GUILD_ID botun erişebildiği bir sunucu değil.');
        ok(`Sunucu erişimi: ${guild.name} (${guild.id})`);

        await guild.members.fetch();
        const configuredRoles = config.discord.modRoles;
        const foundRoles = guild.roles.cache.filter(role => configuredRoles.includes(role.name));
        const missingRoles = configuredRoles.filter(name => !foundRoles.some(role => role.name === name));
        if (missingRoles.length > 0) bad(`Bulunamayan MOD_ROLES: ${missingRoles.join(', ')}`);
        else ok(`Moderatör rolleri bulundu: ${configuredRoles.join(', ')}`);

        const matchingMembers = guild.members.cache.filter(member =>
            !member.user.bot && member.roles.cache.some(role => configuredRoles.includes(role.name))
        );
        if (matchingMembers.size === 0) warn('Yapılandırılmış rollerde insan moderatör bulunamadı.');
        else ok(`Eşleşen moderatör sayısı: ${matchingMembers.size}`);

        const permissionResult = await new PermissionChecker(client).checkBotPermissions();
        if (permissionResult.success) {
            ok('Yapılandırılmış kanallardaki etkin bot izinleri yeterli.');
            if ((permissionResult.missingPermissions || []).length > 0) {
                warn(`Sunucu tabanında eksik görünen fakat kanal overwrite ile telafi edilen izinler: ${permissionResult.missingPermissions.join(', ')}`);
            }
        } else {
            bad('Bot/kanal izinlerinde sorun var.');
            for (const item of permissionResult.channelProblems || []) console.error(`     Kanal: ${item}`);
        }

        if (config.project.updateCheckEnabled) {
            try {
                const monitor = new ProjectMonitor(client);
                const status = await monitor.getUpdateStatus({ force: true });
                if (status.latestVersion) {
                    ok(`GitHub release erişimi: mevcut v${status.currentVersion}, son ${status.latestVersion}`);
                } else {
                    warn(`GitHub release bulunamadı: ${config.project.repository}`);
                }
            } catch (error) {
                warn(`GitHub güncelleme kontrolü yapılamadı: ${error.message}`);
            }
        }
    } catch (error) {
        bad(error.message);
    } finally {
        try { client.destroy(); } catch {}
        try { await database.close(); } catch {}
    }

    if (failed) process.exitCode = 1;
    else console.log('\nTüm kritik canlı kontroller başarılı.');
}

main();
