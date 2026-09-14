const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logLevel = 'info') {
        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
        this.logLevel = Object.prototype.hasOwnProperty.call(this.levels, logLevel) ? logLevel : 'info';
        this.logsDir = path.join(process.cwd(), 'logs');
        fs.mkdirSync(this.logsDir, { recursive: true });
    }

    shouldLog(level) {
        return Object.prototype.hasOwnProperty.call(this.levels, level)
            && this.levels[level] <= this.levels[this.logLevel];
    }

    normalizeData(data) {
        if (data instanceof Error) return { message: data.message, stack: data.stack };
        return data;
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const normalized = this.normalizeData(data);
        let suffix = '';
        if (normalized !== null && normalized !== undefined) {
            try { suffix = ` ${JSON.stringify(normalized)}`; }
            catch { suffix = ` ${String(normalized)}`; }
        }
        return `[${timestamp}] [${level.toUpperCase()}] ${String(message)}${suffix}`;
    }

    writeToFile(message) {
        try {
            const date = new Date().toISOString().slice(0, 10);
            fs.appendFileSync(path.join(this.logsDir, `bot-${date}.log`), `${message}\n`);
        } catch (error) {
            console.error('Log dosyasına yazma hatası:', error.message);
        }
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;
        const formatted = this.formatMessage(level, message, data);
        if (level === 'error') console.error(formatted);
        else if (level === 'warn') console.warn(formatted);
        else console.log(formatted);
        this.writeToFile(formatted);
    }

    error(message, data = null) { this.log('error', message, data); }
    warn(message, data = null) { this.log('warn', message, data); }
    info(message, data = null) { this.log('info', message, data); }
    debug(message, data = null) { this.log('debug', message, data); }

    discordEvent(eventName, data = null) { this.info(`Discord Event: ${eventName}`, data); }
    commandUsed(commandName, userId, username) { this.info(`Komut kullanıldı: ${commandName}`, { userId, username }); }
    surveyResponse(userId, username, period) { this.info(`Anket yanıtı alındı: ${username} (${period})`, { userId }); }
    disciplineApplied(userId, username, duration, reason) { this.warn(`Planlama cezası uygulandı: ${username} - ${duration}`, { userId, reason }); }

    botError(error, context = null) {
        const safeError = error instanceof Error ? error : new Error(String(error));
        this.error('Bot hatası', { message: safeError.message, stack: safeError.stack, context });
    }
}

module.exports = Logger;
