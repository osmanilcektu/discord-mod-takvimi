const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const Logger = require('./utils/logger');

let config;
try {
    config = require('./utils/config');
} catch (error) {
    console.error(`Konfigürasyon yüklenemedi: ${error.message}`);
    process.exit(1);
}
const Database = require('./database/database');
const FullyAutomaticScheduler = require('./utils/fullyAutomaticScheduler');
const ProjectMonitor = require('./utils/projectMonitor');

const logger = new Logger(config.logging.level);
const database = new Database(config.database.path, config.timeSlots);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();
client.cooldowns = new Map();
client.database = database;
client.logger = logger;
client.config = config;
client.automaticScheduler = null;
client.projectMonitor = null;

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const files = fs.existsSync(commandsPath)
        ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')).sort()
        : [];

    for (const file of files) {
        const command = require(path.join(commandsPath, file));
        if (!command?.data?.name || typeof command.execute !== 'function') {
            throw new Error(`Geçersiz komut modülü: ${file}`);
        }
        if (client.commands.has(command.data.name)) {
            throw new Error(`Tekrarlanan komut adı: ${command.data.name}`);
        }
        client.commands.set(command.data.name, command);
        logger.debug(`Komut yüklendi: ${command.data.name}`);
    }
}

function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const files = fs.existsSync(eventsPath)
        ? fs.readdirSync(eventsPath).filter(file => file.endsWith('.js')).sort()
        : [];

    for (const file of files) {
        const event = require(path.join(eventsPath, file));
        if (!event?.name || typeof event.execute !== 'function') {
            throw new Error(`Geçersiz event modülü: ${file}`);
        }
        const handler = (...args) => event.execute(...args, client);
        if (event.once) client.once(event.name, handler);
        else client.on(event.name, handler);
        logger.debug(`Event yüklendi: ${event.name}`);
    }
}

async function deployCommands() {
    const commands = [...client.commands.values()].map(command => command.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    const data = await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.discord.guildId),
        { body: commands }
    );
    logger.info(`${data.length} slash komut sunucuya kaydedildi.`);
}

async function scanModerators() {
    const guild = client.guilds.cache.get(config.discord.guildId)
        || await client.guilds.fetch(config.discord.guildId).catch(() => null);
    if (!guild) throw new Error('Yapılandırılan Discord sunucusu bulunamadı.');

    await guild.members.fetch();
    const activeIds = [];

    for (const member of guild.members.cache.values()) {
        if (member.user.bot) continue;
        const roles = member.roles.cache.map(role => role.name)
            .filter(role => config.discord.modRoles.includes(role));
        if (roles.length === 0) continue;

        activeIds.push(member.id);
        await database.updateModerator(
            member.id,
            member.user.username,
            member.displayName,
            roles
        );
    }

    await database.deactivateMissingModerators(activeIds);
    logger.info(`${activeIds.length} moderatör tarandı ve veritabanı güncellendi.`);
    return activeIds.length;
}

async function onReadyBootstrap() {
    try {
        await deployCommands();
    } catch (error) {
        logger.botError(error, 'Slash komut kaydı');
    }

    try {
        await scanModerators();
    } catch (error) {
        logger.botError(error, 'Moderatör tarama');
        logger.warn('Server Members Intent açık değilse Discord Developer Portal üzerinden etkinleştirin.');
    }

    client.automaticScheduler = new FullyAutomaticScheduler(client);
    client.automaticScheduler.start();

    client.projectMonitor = new ProjectMonitor(client);
    client.projectMonitor.start();

    logger.info('Bot başlangıç işlemleri tamamlandı.');
}

async function start() {
    config.assertValid();
    await database.connect();
    await database.init();
    loadCommands();
    loadEvents();
    client.once(Events.ClientReady, onReadyBootstrap);
    await client.login(config.discord.token);
}

let shuttingDown = false;
async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} alındı. Bot kapatılıyor...`);

    try {
        client.projectMonitor?.stop();
        client.automaticScheduler?.stop();
        if (client.isReady()) client.destroy();
        await database.close();
    } catch (error) {
        logger.botError(error, 'Graceful shutdown');
    } finally {
        process.exit(exitCode);
    }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', error => logger.botError(error instanceof Error ? error : new Error(String(error)), 'Unhandled Rejection'));
process.on('uncaughtException', error => {
    logger.botError(error, 'Uncaught Exception');
    void shutdown('uncaughtException', 1);
});

start().catch(async error => {
    logger.botError(error, 'Bot başlangıcı');
    try { await database.close(); } catch {}
    process.exit(1);
});
