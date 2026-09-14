require('dotenv').config();

const { DEFAULT_TIMEZONE, parseTimeRange, getLocalDateString } = require('./dateTime');

function intEnv(name, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} geçersiz. Beklenen aralık: ${min}-${max}`);
    }
    return value;
}

function boolEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    throw new Error(`${name} geçersiz boolean değer içeriyor: ${raw}`);
}

function parseTimeSlots(raw) {
    const fallback = [
        '00:00-05:00',
        '05:00-10:00',
        '10:00-15:00',
        '15:00-20:00',
        '20:00-24:00'
    ];
    if (!raw) return fallback;

    let slots;
    try {
        slots = JSON.parse(raw);
    } catch (error) {
        throw new Error(`TIME_SLOTS JSON olarak ayrıştırılamadı: ${error.message}`);
    }

    if (!Array.isArray(slots) || slots.length !== 5) {
        throw new Error('TIME_SLOTS tam olarak 5 vardiya içeren bir JSON dizi olmalıdır.');
    }

    const parsed = [];
    for (const slot of slots) {
        const range = typeof slot === 'string' ? parseTimeRange(slot) : null;
        if (!range) throw new Error(`Geçersiz TIME_SLOTS değeri: ${slot}`);
        parsed.push(range);
    }

    if (parsed[0].start !== 0 || parsed[parsed.length - 1].end !== 1440) {
        throw new Error('TIME_SLOTS 00:00 ile başlamalı ve 24:00 ile bitmelidir.');
    }
    for (let index = 1; index < parsed.length; index += 1) {
        if (parsed[index].start !== parsed[index - 1].end) {
            throw new Error('TIME_SLOTS vardiyaları boşluk veya çakışma olmadan ardışık olmalıdır.');
        }
    }

    return slots;
}

const config = {
    discord: {
        token: process.env.DISCORD_TOKEN?.trim(),
        guildId: process.env.GUILD_ID?.trim(),
        adminModChannelId: process.env.ADMIN_MOD_CHANNEL_ID?.trim(),
        modScheduleChannelId: (process.env.MOD_SCHEDULE_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID)?.trim(),
        logChannelId: (process.env.LOG_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID)?.trim(),
        scheduleChannelId: (process.env.SCHEDULE_CHANNEL_ID || process.env.MOD_SCHEDULE_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID)?.trim(),
        modRoles: process.env.MOD_ROLES
            ? process.env.MOD_ROLES.split(',').map(role => role.trim()).filter(Boolean)
            : ['MOD', 'SR MOD', 'HEAD MOD']
    },

    schedule: {
        responseTimeoutHours: intEnv('RESPONSE_TIMEOUT_HOURS', 24, { min: 1, max: 168 }),
        autoScheduleEnabled: boolEnv('AUTO_SCHEDULE_ENABLED', false),
        dailyScheduleHour: intEnv('DAILY_SCHEDULE_HOUR', 8, { min: 0, max: 23 }),
        surveyTimeoutHours: intEnv('SURVEY_TIMEOUT_HOURS', 5, { min: 1, max: 24 }),
        timezone: process.env.TIMEZONE?.trim() || DEFAULT_TIMEZONE
    },

    discipline: {
        firstViolationDays: intEnv('FIRST_VIOLATION_DAYS', 2, { min: 1, max: 365 }),
        secondViolationHours: intEnv('SECOND_VIOLATION_HOURS', 1, { min: 1, max: 168 }),
        thirdViolationDays: intEnv('THIRD_VIOLATION_DAYS', 1, { min: 1, max: 365 })
    },

    timeSlots: parseTimeSlots(process.env.TIME_SLOTS),

    database: {
        path: process.env.DATABASE_PATH?.trim() || './data/bot.db'
    },

    logging: {
        level: process.env.LOG_LEVEL?.trim() || 'info'
    },

    project: {
        repository: process.env.GITHUB_REPOSITORY?.trim() || 'osmanilcektu/discord-mod-takvimi',
        updateCheckEnabled: boolEnv('UPDATE_CHECK_ENABLED', true),
        updateCheckIntervalHours: intEnv('UPDATE_CHECK_INTERVAL_HOURS', 6, { min: 1, max: 168 }),
        updateChannelId: (process.env.UPDATE_CHANNEL_ID || process.env.LOG_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID)?.trim(),
        reportingEnabled: boolEnv('REPORTING_ENABLED', false),
        reportChannelId: (process.env.REPORT_CHANNEL_ID || process.env.LOG_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID)?.trim(),
        startupReportEnabled: boolEnv('STARTUP_REPORT_ENABLED', false),
        dailyReportEnabled: boolEnv('DAILY_REPORT_ENABLED', false),
        dailyReportHour: intEnv('DAILY_REPORT_HOUR', 9, { min: 0, max: 23 })
    }
};

function validateDiscordSnowflake(value) {
    const normalized = String(value || '').trim();
    return /^\d{16,22}$/.test(normalized) && normalized !== '123456789012345678';
}

function validate() {
    const errors = [];

    if (!config.discord.token || config.discord.token === 'your_bot_token_here') {
        errors.push('DISCORD_TOKEN tanımlı değil.');
    }
    if (!validateDiscordSnowflake(config.discord.guildId)) {
        errors.push('GUILD_ID gerçek bir Discord ID olmalı; örnek placeholder kullanılamaz.');
    }
    const channelChecks = [
        ['ADMIN_MOD_CHANNEL_ID', config.discord.adminModChannelId],
        ['LOG_CHANNEL_ID', config.discord.logChannelId],
        ['SCHEDULE_CHANNEL_ID', config.discord.scheduleChannelId],
        ['MOD_SCHEDULE_CHANNEL_ID', config.discord.modScheduleChannelId]
    ];
    for (const [name, value] of channelChecks) {
        if (!validateDiscordSnowflake(value)) errors.push(`${name} gerçek bir Discord ID olmalı; örnek placeholder kullanılamaz.`);
    }
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: config.schedule.timezone }).format(new Date());
    } catch {
        errors.push('TIMEZONE geçerli bir IANA saat dilimi olmalıdır (örn. Europe/Istanbul).');
    }
    if (!['error', 'warn', 'info', 'debug'].includes(config.logging.level)) {
        errors.push('LOG_LEVEL error, warn, info veya debug olmalıdır.');
    }
    if (config.discord.modRoles.length === 0) {
        errors.push('En az bir MOD_ROLES değeri gerekli.');
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.project.repository)) {
        errors.push('GITHUB_REPOSITORY owner/repo biçiminde olmalıdır.');
    }
    const projectChannels = [
        ['UPDATE_CHANNEL_ID', config.project.updateChannelId, config.project.updateCheckEnabled],
        ['REPORT_CHANNEL_ID', config.project.reportChannelId, config.project.reportingEnabled]
    ];
    for (const [name, value, required] of projectChannels) {
        if (required && !validateDiscordSnowflake(value)) errors.push(`${name} gerçek bir Discord ID olmalı; örnek placeholder kullanılamaz.`);
    }

    return errors;
}

function assertValid() {
    const errors = validate();
    if (errors.length > 0) {
        throw new Error(`Konfigürasyon hatası:\n- ${errors.join('\n- ')}`);
    }
}

function getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getCurrentPeriod() {
    const localDate = getLocalDateString(new Date(), config.schedule.timezone);
    const [year, month, day] = localDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const week = getWeekNumber(date);
    // ISO haftası yıl sınırında komşu yıla ait olabilir.
    const thursday = new Date(date);
    const dayNum = thursday.getUTCDay() || 7;
    thursday.setUTCDate(thursday.getUTCDate() + 4 - dayNum);
    const weekYear = thursday.getUTCFullYear();
    return `${weekYear}-W${String(week).padStart(2, '0')}`;
}


module.exports = {
    ...config,
    validate,
    assertValid,
    utils: {
        getCurrentPeriod,
        getWeekNumber,
        validateTimeSlots: slots => {
            try {
                parseTimeSlots(JSON.stringify(slots));
                return true;
            } catch {
                return false;
            }
        }
    }
};
