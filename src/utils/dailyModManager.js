const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const AutoScheduleManager = require('./autoScheduleManager');
const { buildSlots } = require('./slots');
const { getLocalDateString, getMinutesInTimeZone, isMinuteInRange, addDaysToDateString } = require('./dateTime');

class DailyModManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
        this.slots = buildSlots(this.config.timeSlots);
        this.autoScheduleManager = new AutoScheduleManager(client);
    }

    async selectDailyMods(date = null) {
        const targetDate = date || getLocalDateString(new Date(), this.config.schedule.timezone);
        if (await this.database.hasScheduleForDate(targetDate)) {
            return { success: false, error: 'Bu tarih için zaten takvim mevcut.' };
        }
        const responses = await this.database.getResponsesForDate(targetDate);
        return this.autoScheduleManager.generateScheduleFromResponses(targetDate, responses);
    }

    async getTodayAssignment() {
        const date = getLocalDateString(new Date(), this.config.schedule.timezone);
        const assignments = await this.database.getAssignmentsForDate(date);
        if (assignments.length === 0) return null;

        const expanded = [];
        for (const assignment of assignments) {
            expanded.push({
                ...assignment,
                moderator: await this.database.getModerator(assignment.user_id),
                slot: this.slots.find(slot => slot.id === assignment.slot_id) || null
            });
        }

        return { date, assignments: expanded };
    }

    async getCurrentActiveMods() {
        const now = new Date();
        const date = getLocalDateString(now, this.config.schedule.timezone);
        const currentMinutes = getMinutesInTimeZone(now, this.config.schedule.timezone);
        const activeSlot = this.slots.find(slot => isMinuteInRange(currentMinutes, {
            start: slot.startMinutes,
            end: slot.endMinutes
        }));
        if (!activeSlot) return [];

        const assignment = await this.database.getAssignmentForSlot(date, activeSlot.id);
        if (!assignment) return [];
        const moderator = await this.database.getModerator(assignment.user_id);
        if (!moderator) return [];

        return [{
            ...moderator,
            shift: activeSlot.label,
            shiftTime: activeSlot.range,
            slotId: activeSlot.id
        }];
    }

    async getNextAssignment() {
        const now = new Date();
        const date = getLocalDateString(now, this.config.schedule.timezone);
        const currentMinutes = getMinutesInTimeZone(now, this.config.schedule.timezone);
        const assignments = await this.database.getAssignmentsForDate(date);

        for (const slot of this.slots) {
            if (slot.startMinutes <= currentMinutes) continue;
            const assignment = assignments.find(item => item.slot_id === slot.id);
            if (!assignment) continue;
            const moderator = await this.database.getModerator(assignment.user_id);
            return { date, slot, assignment, moderator };
        }

        const tomorrow = addDaysToDateString(date, 1);
        const tomorrowAssignments = await this.database.getAssignmentsForDate(tomorrow);
        for (const slot of this.slots) {
            const assignment = tomorrowAssignments.find(item => item.slot_id === slot.id);
            if (!assignment) continue;
            const moderator = await this.database.getModerator(assignment.user_id);
            return { date: tomorrow, slot, assignment, moderator };
        }
        return null;
    }

    async reselectDailyMods(date) {
        await this.database.deleteScheduleForDate(date);
        const responses = await this.database.getResponsesForDate(date);
        return this.autoScheduleManager.generateScheduleFromResponses(date, responses);
    }

    async handleInteraction(interaction) {
        const id = interaction.customId || '';
        if (id.startsWith('reselect_daily_')) return this.handleReselect(interaction);
        if (id.startsWith('manual_assign_')) return this.handleManualAssign(interaction);
        throw new Error(`Desteklenmeyen günlük vardiya interaction: ${id}`);
    }

    async handleReselect(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Bu işlem için yönetici yetkisi gerekir.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const date = interaction.customId.slice('reselect_daily_'.length);
        const result = await this.reselectDailyMods(date);
        await interaction.editReply({
            content: result.success
                ? `✅ **${date}** takvimi yeniden oluşturuldu. ${result.summary || ''}`
                : `❌ Takvim oluşturulamadı: ${result.error}`
        });
    }

    async handleManualAssign(interaction) {
        await interaction.reply({
            content: '📝 Manuel değişiklik için `/admin saat-degistir` komutunu kullanın.',
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = DailyModManager;
