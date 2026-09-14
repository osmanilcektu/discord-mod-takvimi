const { EmbedBuilder } = require('discord.js');
const { buildSlots } = require('./slots');
const { parseClock } = require('./dateTime');

class AutoScheduleManager {
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.config = client.config;
        this.logger = client.logger;
        this.slots = buildSlots(this.config.timeSlots);
    }

    async createDailySchedule(date) {
        try {
            if (await this.database.hasScheduleForDate(date)) {
                return { success: false, error: 'Bu tarih için zaten takvim mevcut.' };
            }

            const existingStatus = await this.database.getScheduleStatus(date);
            if (existingStatus?.status === 'survey_sent') {
                return {
                    success: true,
                    pending: true,
                    summary: `Bu tarih için anket zaten gönderilmiş. Son yanıt: ${existingStatus.survey_deadline}`
                };
            }

            const activeModerators = await this.database.getActiveModerators();
            const punishedIds = new Set((await this.database.getPunishedUsers()).map(item => item.user_id));
            const moderators = activeModerators.filter(mod => !punishedIds.has(mod.user_id));
            if (moderators.length === 0) {
                return { success: false, error: 'Anket gönderilebilecek aktif ve cezasız moderatör bulunamadı.' };
            }

            const timeoutMs = this.config.schedule.surveyTimeoutHours * 60 * 60 * 1000;
            const deadline = new Date(Date.now() + timeoutMs);
            await this.database.saveScheduleStatus(date, 'survey_sent', deadline.toISOString());

            const SurveyManager = require('./surveyManager');
            const surveyManager = new SurveyManager(this.client);
            let sentCount = 0;
            let failedCount = 0;

            for (const mod of moderators) {
                try {
                    const user = await this.client.users.fetch(mod.user_id);
                    await surveyManager.sendDailyScheduleSurvey(user, date);
                    await this.database.recordSurveyDelivery(date, mod.user_id, 'sent');
                    sentCount += 1;
                } catch (error) {
                    failedCount += 1;
                    await this.database.recordSurveyDelivery(date, mod.user_id, 'failed', error.message).catch(() => {});
                    this.logger.error(`${mod.username} kullanıcısına anket gönderilemedi:`, error.message);
                }

                if (moderators.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            }

            if (sentCount === 0) {
                await this.database.saveScheduleStatus(date, 'failed');
                return { success: false, error: 'Anket hiçbir moderatöre teslim edilemedi. DM izinlerini ve kullanıcı erişimini kontrol edin.' };
            }

            return {
                success: true,
                pending: true,
                summary: `📊 Anket gönderimi: Başarılı ${sentCount}, Başarısız ${failedCount}\n⏰ Yanıt süresi: ${this.config.schedule.surveyTimeoutHours} saat`
            };
        } catch (error) {
            this.logger.botError(error, 'Otomatik takvim oluşturma');
            return { success: false, error: error.message };
        }
    }

    async checkSurveyResponses(date) {
        try {
            if (await this.database.hasScheduleForDate(date)) {
                await this.database.saveScheduleStatus(date, 'completed');
                return { success: true, alreadyCompleted: true };
            }

            const status = await this.database.getScheduleStatus(date);
            if (!status || status.status !== 'survey_sent') {
                return { success: false, error: 'Bu tarih için bekleyen anket bulunamadı.' };
            }

            const responses = await this.database.getResponsesForDate(date);
            const respondedIds = new Set(responses.map(response => response.user_id));
            const surveyedUserIds = await this.database.getSuccessfullySurveyedUserIds(date);
            const moderators = await this.database.getActiveModerators();
            const moderatorMap = new Map(moderators.map(mod => [mod.user_id, mod]));

            for (const userId of surveyedUserIds) {
                if (!respondedIds.has(userId) && moderatorMap.has(userId)) {
                    await this.punishNonRespondent(moderatorMap.get(userId), date);
                }
            }

            const result = await this.generateScheduleFromResponses(date, responses);
            if (!result.success) {
                await this.database.saveScheduleStatus(date, 'failed');
                return result;
            }

            await this.database.saveScheduleStatus(date, 'completed');
            this.logger.info(`${date} için otomatik takvim oluşturma tamamlandı.`);
            return result;
        } catch (error) {
            this.logger.botError(error, 'Anket yanıt kontrolü');
            await this.database.saveScheduleStatus(date, 'failed').catch(() => {});
            return { success: false, error: error.message };
        }
    }

    async punishNonRespondent(moderator, date) {
        try {
            const activePunishments = await this.database.getActivePunishmentsForUser(moderator.user_id);
            if (activePunishments.length > 0) {
                this.logger.debug(`${moderator.username} zaten aktif planlama cezasında; yeni ceza eklenmedi.`);
                return;
            }
            const existing = (await this.database.getViolationHistory(moderator.user_id))
                .find(item => item.date === date && item.reason === 'no_response');
            if (existing) return;

            const history = await this.database.getViolationHistory(moderator.user_id);
            const now = Date.now();
            let punishmentType;
            let punishmentEnd;

            if (history.length === 0) {
                punishmentType = 'ban_2day';
                punishmentEnd = new Date(now + this.config.discipline.firstViolationDays * 86400000);
            } else if (history.length === 1) {
                punishmentType = 'ban_1hour';
                punishmentEnd = new Date(now + this.config.discipline.secondViolationHours * 3600000);
            } else {
                punishmentType = 'ban_1day';
                punishmentEnd = new Date(now + this.config.discipline.thirdViolationDays * 86400000);
            }

            const record = await this.database.recordAbsentUser(
                moderator.user_id,
                moderator.username,
                date,
                'no_response',
                punishmentType,
                punishmentEnd.toISOString()
            );

            if (!record.duplicate) {
                await this.sendPunishmentNotification(moderator, punishmentType, punishmentEnd, record.violationCount);
                await this.logPunishment(moderator, date, punishmentType, punishmentEnd, record.violationCount);
            }
        } catch (error) {
            this.logger.error(`${moderator.username} cezalandırma hatası:`, error.message);
        }
    }

    async sendPunishmentNotification(moderator, punishmentType, punishmentEnd, violationCount) {
        try {
            const user = await this.client.users.fetch(moderator.user_id);
            const labels = {
                ban_2day: `${this.config.discipline.firstViolationDays} Gün Moderatörlük Kısıtlaması`,
                ban_1hour: `${this.config.discipline.secondViolationHours} Saat Kısıtlama`,
                ban_1day: `${this.config.discipline.thirdViolationDays} Gün Moderatörlük Kısıtlaması`
            };

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Ceza Bildirimi')
                .setDescription('Günlük takvim anketine zamanında yanıt verilmediği için geçici planlama kısıtlaması uygulandı.')
                .addFields(
                    { name: '⏰ Ceza', value: labels[punishmentType] || punishmentType, inline: true },
                    { name: '🔢 İhlal Sayısı', value: String(violationCount), inline: true },
                    { name: '⏳ Bitiş', value: punishmentEnd.toLocaleString('tr-TR', { timeZone: this.config.schedule.timezone }), inline: false }
                )
                .setTimestamp();

            await user.send({ embeds: [embed] });
        } catch (error) {
            this.logger.warn(`${moderator.username} kullanıcısına ceza bildirimi gönderilemedi: ${error.message}`);
        }
    }

    async getAvailableModerators(date = null, excludedUserIds = new Set()) {
        const allMods = await this.database.getActiveModerators();
        const punishedIds = new Set((await this.database.getPunishedUsers()).map(item => item.user_id));
        const assignedIds = date
            ? new Set((await this.database.getAssignmentsForDate(date)).map(item => item.user_id))
            : new Set();

        return allMods.filter(mod =>
            !punishedIds.has(mod.user_id) &&
            !excludedUserIds.has(mod.user_id) &&
            !assignedIds.has(mod.user_id)
        );
    }

    async generateScheduleFromResponses(date, responses) {
        try {
            const availableMods = await this.getAvailableModerators();
            if (availableMods.length === 0) {
                return { success: false, error: 'Atanabilecek aktif moderatör bulunamadı.' };
            }

            const workload = await this.analyzeModeratorWorkload(availableMods, date);
            const plan = [];
            const usedUserIds = new Set();
            const responseMap = new Map(responses.map(response => [response.user_id, response]));
            const modMap = new Map(availableMods.map(mod => [mod.user_id, mod]));

            const permanentShifts = await this.database.getAllPermanentShifts();
            for (const permanent of permanentShifts) {
                const slot = this.slots.find(item => item.id === permanent.slot_id);
                const moderator = modMap.get(permanent.user_id);
                if (!slot || !moderator || usedUserIds.has(moderator.user_id)) continue;
                if (plan.some(item => item.slot.id === slot.id)) {
                    this.logger.warn(`Kalıcı vardiya çakışması: ${slot.id}. ${moderator.username} atlanıyor.`);
                    continue;
                }
                const response = responseMap.get(moderator.user_id);
                if (!this.isResponseAvailableForSlot(response, slot)) continue;
                if (!(await this.isModeratorAllowedForSlot(moderator.user_id, slot))) continue;

                plan.push({ slot, moderator, type: 'permanent' });
                usedUserIds.add(moderator.user_id);
            }

            for (const slot of this.slots) {
                if (plan.some(item => item.slot.id === slot.id)) continue;

                const selected = await this.selectBestModeratorForSlot(
                    slot,
                    availableMods,
                    responseMap,
                    workload,
                    usedUserIds
                );

                if (selected) {
                    plan.push({ slot, moderator: selected, type: 'smart_rotation' });
                    usedUserIds.add(selected.user_id);
                    workload[selected.user_id] = (workload[selected.user_id] || 0) + slot.hours;
                }
            }

            if (plan.length === 0) {
                return { success: false, error: 'Hiçbir vardiya için uygun moderatör bulunamadı.' };
            }

            await this.database.saveScheduleAssignments(date, plan.map(item => ({
                user_id: item.moderator.user_id,
                slot_id: item.slot.id,
                assignment_type: item.type
            })));

            try {
                await this.publishGeneratedSchedule(date);
            } catch (error) {
                this.logger.warn(`Takvim Discord kanalına yayınlanamadı; veritabanı atamaları korundu: ${error.message}`);
            }
            await this.notifyAssignedModerators(date, plan);

            const missing = this.slots.filter(slot => !plan.some(item => item.slot.id === slot.id));
            return {
                success: true,
                assignments: plan.length,
                missingSlots: missing.map(slot => slot.id),
                summary: `${plan.length}/${this.slots.length} vardiya oluşturuldu${missing.length ? `; boş: ${missing.map(slot => slot.id).join(', ')}` : ''}.`
            };
        } catch (error) {
            this.logger.error('Takvim oluşturma hatası:', error.message);
            return { success: false, error: error.message };
        }
    }

    async selectBestModeratorForSlot(slot, moderators, responseMap, workload, usedUserIds) {
        const candidates = [];

        for (const mod of moderators) {
            if (usedUserIds.has(mod.user_id)) continue;
            if (!(await this.isModeratorAllowedForSlot(mod.user_id, slot))) continue;

            const response = responseMap.get(mod.user_id);
            if (!this.isResponseAvailableForSlot(response, slot)) continue;

            candidates.push({
                mod,
                workload: workload[mod.user_id] || 0
            });
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.workload !== b.workload) return a.workload - b.workload;
            return a.mod.username.localeCompare(b.mod.username, 'tr');
        });

        return candidates[0].mod;
    }

    isResponseAvailableForSlot(response, slot) {
        if (!response || response.excuse?.trim()) return false;
        const availability = Array.isArray(response.availability) ? response.availability : [];
        return availability.includes(slot.id) || availability.includes(slot.range);
    }

    async isModeratorAllowedForSlot(userId, slot) {
        const permissions = await this.database.getUserTimePermissions(userId);
        if (permissions.length === 0) return true;

        const overlap = permission => {
            let start = parseClock(permission.start_time);
            let end = parseClock(permission.end_time);
            if (start === null || end === null) return false;
            if (end <= start) end += 1440;

            let slotStart = slot.startMinutes;
            let slotEnd = slot.endMinutes;
            if (slotEnd <= slotStart) slotEnd += 1440;

            const ranges = [[start, end]];
            if (end > 1440) ranges.push([start - 1440, end - 1440]);
            return ranges.some(([rangeStart, rangeEnd]) => slotStart < rangeEnd && slotEnd > rangeStart);
        };

        if (permissions.some(permission => permission.permission_type === 'restrict' && overlap(permission))) {
            return false;
        }

        const allowRules = permissions.filter(permission => permission.permission_type === 'allow');
        if (allowRules.length === 0) return true;
        return allowRules.some(overlap);
    }

    async analyzeModeratorWorkload(moderators, currentDate) {
        const workload = Object.fromEntries(moderators.map(mod => [mod.user_id, 0]));
        const [year, month, day] = currentDate.split('-').map(Number);

        for (let offset = 1; offset <= 7; offset += 1) {
            const date = new Date(Date.UTC(year, month - 1, day));
            date.setUTCDate(date.getUTCDate() - offset);
            const dateString = date.toISOString().slice(0, 10);

            for (const mod of moderators) {
                const assignments = await this.database.getUserAssignmentsForDate(mod.user_id, dateString);
                workload[mod.user_id] += assignments.reduce((sum, assignment) => {
                    const slot = this.slots.find(item => item.id === assignment.slot_id);
                    return sum + (slot?.hours || 0);
                }, 0);
            }
        }

        return workload;
    }

    getSlotHours(slotId) {
        return this.slots.find(slot => slot.id === slotId)?.hours || 0;
    }

    async publishGeneratedSchedule(date) {
        const assignments = await this.database.getAssignmentsForDate(date);
        if (assignments.length === 0) return;

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('📅 Günlük Moderatör Takvimi')
            .setDescription(`**${date}** tarihli otomatik oluşturulan takvim`)
            .setTimestamp();

        for (const assignment of assignments) {
            const moderator = await this.database.getModerator(assignment.user_id);
            const slot = this.slots.find(item => item.id === assignment.slot_id);
            embed.addFields({
                name: slot?.name || assignment.slot_name || assignment.slot_id,
                value: `<@${assignment.user_id}> (${moderator?.username || 'Bilinmiyor'})`,
                inline: false
            });
        }

        const channelId = this.config.discord.scheduleChannelId;
        if (!channelId) return;
        const channel = await this.client.channels.fetch(channelId);
        if (!channel?.isTextBased?.()) throw new Error('Takvim kanalı metin kanalı değil.');
        await channel.send({ embeds: [embed] });
    }

    async notifyAssignedModerators(date, plan) {
        for (const item of plan) {
            try {
                const user = await this.client.users.fetch(item.moderator.user_id);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('👮 Moderatör Vardiya Ataması')
                        .setDescription(`**${date}** tarihinde vardiyaya atandınız.`)
                        .addFields({ name: '🕒 Vardiya', value: item.slot.name })
                        .setTimestamp()]
                });
            } catch (error) {
                this.logger.warn(`${item.moderator.username} kullanıcısına vardiya bildirimi gönderilemedi: ${error.message}`);
            }
        }
    }

    async logPunishment(moderator, date, punishmentType, punishmentEnd, violationCount) {
        try {
            const channelId = this.config.discord.logChannelId;
            if (!channelId) return;
            const channel = await this.client.channels.fetch(channelId);
            if (!channel?.isTextBased?.()) return;

            await channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 Otomatik Planlama Cezası')
                    .addFields(
                        { name: '👤 Kullanıcı', value: `${moderator.username} <@${moderator.user_id}>`, inline: true },
                        { name: '📅 Tarih', value: date, inline: true },
                        { name: '📝 Sebep', value: 'Ankete yanıt vermeme', inline: true },
                        { name: '⏰ Ceza', value: punishmentType, inline: true },
                        { name: '🔢 İhlal', value: String(violationCount), inline: true },
                        { name: '⏳ Bitiş', value: punishmentEnd.toLocaleString('tr-TR', { timeZone: this.config.schedule.timezone }), inline: true }
                    )
                    .setTimestamp()]
            });
        } catch (error) {
            this.logger.warn(`Ceza logu gönderilemedi: ${error.message}`);
        }
    }
}

module.exports = AutoScheduleManager;
