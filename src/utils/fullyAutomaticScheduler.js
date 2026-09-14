const cron = require('node-cron');
const AutoScheduleManager = require('./autoScheduleManager');
const { getLocalDateString, addDaysToDateString, getMinutesInTimeZone } = require('./dateTime');

class FullyAutomaticScheduler {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
        this.autoScheduleManager = new AutoScheduleManager(client);
        this.isRunning = false;
        this.tasks = [];
        this.lastHealthAlertAt = 0;
        this.surveyStartInFlight = false;
    }

    schedule(expression, handler) {
        const task = cron.schedule(expression, async () => {
            try {
                await handler();
            } catch (error) {
                this.logger.botError(error, `Cron: ${expression}`);
            }
        }, { timezone: this.config.schedule.timezone });
        this.tasks.push(task);
        return task;
    }

    start() {
        if (!this.config.schedule.autoScheduleEnabled) {
            this.logger.info('Otomatik takvim sistemi devre dışı.');
            return;
        }
        if (this.isRunning) {
            this.logger.warn('Otomatik takvim sistemi zaten çalışıyor.');
            return;
        }

        const hour = this.config.schedule.dailyScheduleHour;
        this.schedule(`0 0 ${hour} * * *`, () => this.startTomorrowSurvey());
        this.schedule('0 */5 * * * *', () => this.recoverDueSurveys());
        this.schedule('0 0 * * * *', () => this.checkExpiredPunishments());
        this.schedule('0 */10 * * * *', () => this.systemHealthCheck());
        this.schedule('0 7,17,27,37,47,57 * * * *', () => this.ensureRecentSurveyStarted());

        this.isRunning = true;
        this.logger.info(`Otomatik takvim sistemi başlatıldı. Günlük anket saati: ${String(hour).padStart(2, '0')}:00`);

        setImmediate(() => {
            this.recoverDueSurveys().catch(error => this.logger.botError(error, 'Bekleyen anket kurtarma'));
            this.checkExpiredPunishments().catch(error => this.logger.botError(error, 'Süresi biten ceza kontrolü'));
            this.ensureRecentSurveyStarted().catch(error => this.logger.botError(error, 'Kaçırılan anket kontrolü'));
        });
    }

    async startSurveyForDate(targetDate) {
        if (this.surveyStartInFlight) return { success: true, pending: true, summary: 'Anket başlatma işlemi zaten devam ediyor.' };
        this.surveyStartInFlight = true;
        try {
            const result = await this.autoScheduleManager.createDailySchedule(targetDate);
            if (result.success) this.logger.info(`${targetDate} için günlük anket hazırlandı. ${result.summary || ''}`);
            else this.logger.warn(`${targetDate} için günlük anket başlatılamadı: ${result.error}`);
            return result;
        } finally {
            this.surveyStartInFlight = false;
        }
    }

    async startTomorrowSurvey() {
        const today = getLocalDateString(new Date(), this.config.schedule.timezone);
        return this.startSurveyForDate(addDaysToDateString(today, 1));
    }

    async ensureRecentSurveyStarted() {
        const now = new Date();
        const today = getLocalDateString(now, this.config.schedule.timezone);
        const currentMinutes = getMinutesInTimeZone(now, this.config.schedule.timezone);
        const scheduledMinutes = this.config.schedule.dailyScheduleHour * 60;

        let runDate;
        let elapsedMinutes;
        if (currentMinutes >= scheduledMinutes) {
            runDate = today;
            elapsedMinutes = currentMinutes - scheduledMinutes;
        } else {
            runDate = addDaysToDateString(today, -1);
            elapsedMinutes = currentMinutes + 1440 - scheduledMinutes;
        }

        if (elapsedMinutes > this.config.schedule.surveyTimeoutHours * 60) return null;
        const targetDate = addDaysToDateString(runDate, 1);
        if (await this.database.hasScheduleForDate(targetDate)) return null;
        const status = await this.database.getScheduleStatus(targetDate);
        if (status) return null;

        this.logger.warn(`${targetDate} için yakın zamanda kaçırılmış günlük anket tespit edildi; şimdi başlatılıyor.`);
        return this.startSurveyForDate(targetDate);
    }

    // Geriye dönük uyumluluk: eski isim aynı davranışı çağırır.
    async checkAndCreateDailySchedule() {
        return this.startTomorrowSurvey();
    }

    async recoverDueSurveys() {
        const due = await this.database.getDueScheduleStatuses();
        for (const status of due) {
            this.logger.info(`${status.date} için süresi dolan anket tamamlanıyor.`);
            const result = await this.autoScheduleManager.checkSurveyResponses(status.date);
            if (!result.success) {
                this.logger.error(`${status.date} takvimi tamamlanamadı: ${result.error}`);
            }
        }
    }

    async checkExpiredPunishments() {
        const expired = await this.database.getExpiredPunishments();
        if (expired.length === 0) return;

        const users = new Map();
        for (const punishment of expired) {
            await this.database.deactivatePunishment(punishment.id);
            if (!users.has(punishment.user_id)) users.set(punishment.user_id, punishment);
        }

        for (const punishment of users.values()) {
            const stillActive = await this.database.getActivePunishmentsForUser(punishment.user_id);
            if (stillActive.length === 0) await this.notifyPunishmentEnded(punishment);
        }
        this.logger.info(`${expired.length} süresi biten planlama cezası kaydı kapatıldı.`);
    }

    async notifyPunishmentEnded(punishment) {
        try {
            const user = await this.client.users.fetch(punishment.user_id);
            await user.send({
                content: '✅ Planlama kısıtlamanız sona erdi. Tekrar vardiyalara atanabilirsiniz.'
            });
        } catch (error) {
            this.logger.warn(`${punishment.username} kullanıcısına ceza bitiş bildirimi gönderilemedi: ${error.message}`);
        }

        try {
            const channelId = this.config.discord.logChannelId;
            if (!channelId) return;
            const channel = await this.client.channels.fetch(channelId);
            if (channel?.isTextBased?.()) {
                await channel.send(`✅ <@${punishment.user_id}> kullanıcısının planlama cezası sona erdi.`);
            }
        } catch (error) {
            this.logger.warn(`Ceza bitiş logu gönderilemedi: ${error.message}`);
        }
    }

    async systemHealthCheck() {
        const isDbHealthy = await this.checkDatabaseHealth();
        const isDiscordHealthy = this.client.isReady();
        if (isDbHealthy && isDiscordHealthy) return;

        this.logger.error(`Sistem sağlık kontrolü başarısız: DB=${isDbHealthy}, Discord=${isDiscordHealthy}`);

        // Aynı arıza sürerken admin kanalını 30 dakikadan sık uyarmayalım.
        if (Date.now() - this.lastHealthAlertAt < 30 * 60 * 1000) return;
        this.lastHealthAlertAt = Date.now();
        await this.alertSystemHealth(isDbHealthy, isDiscordHealthy);
    }

    async checkDatabaseHealth() {
        try {
            await this.database.getActiveModerators();
            return true;
        } catch {
            return false;
        }
    }

    async alertSystemHealth(isDbHealthy, isDiscordHealthy) {
        try {
            const channelId = this.config.discord.adminModChannelId;
            if (!channelId || !this.client.isReady()) return;
            const channel = await this.client.channels.fetch(channelId);
            if (!channel?.isTextBased?.()) return;
            await channel.send(
                `🚨 **Sistem sağlık uyarısı**\nVeritabanı: ${isDbHealthy ? '✅' : '❌'}\nDiscord: ${isDiscordHealthy ? '✅' : '❌'}`
            );
        } catch (error) {
            this.logger.warn(`Sistem sağlık uyarısı gönderilemedi: ${error.message}`);
        }
    }

    stop() {
        for (const task of this.tasks) {
            try {
                task.stop();
                if (typeof task.destroy === 'function') task.destroy();
            } catch (error) {
                this.logger.warn(`Cron görevi durdurulamadı: ${error.message}`);
            }
        }
        this.tasks = [];
        this.isRunning = false;
        this.logger.info('Otomatik takvim sistemi durduruldu.');
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            autoScheduleEnabled: this.config.schedule.autoScheduleEnabled,
            dailyScheduleHour: this.config.schedule.dailyScheduleHour,
            surveyTimeoutHours: this.config.schedule.surveyTimeoutHours,
            taskCount: this.tasks.length
        };
    }
}

module.exports = FullyAutomaticScheduler;
