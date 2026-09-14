const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');
const { buildSlots } = require('./slots');
const { isValidDateString } = require('./dateTime');

class SurveyManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
        this.slots = buildSlots(this.config.timeSlots);
        if (!this.client.surveySelections) this.client.surveySelections = new Map();
    }

    selectionKey(userId, period) {
        return `${userId}:${period}`;
    }

    async sendDailyScheduleSurvey(user, date) {
        const deadline = new Date(Date.now() + this.config.schedule.surveyTimeoutHours * 3600000);
        const embed = new EmbedBuilder()
            .setColor('#00a86b')
            .setTitle('📅 Günlük Moderatör Takvimi')
            .setDescription(`**${date}** tarihi için müsait olduğunuz vardiyaları seçin.`)
            .addFields(
                { name: '⏰ Yanıt Süresi', value: `**${this.config.schedule.surveyTimeoutHours} saat**`, inline: true },
                { name: '⚠️ Not', value: 'Yanıt veremeyecekseniz mazeret butonunu kullanın.', inline: false }
            )
            .setFooter({ text: `Son yanıt: ${deadline.toLocaleString('tr-TR', { timeZone: this.config.schedule.timezone })}` })
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId(`daily_shift_select_${date}`)
            .setPlaceholder('Müsait olduğunuz vardiyaları seçin...')
            .setMinValues(1)
            .setMaxValues(this.slots.length)
            .addOptions(this.slots.map(slot => ({
                label: `Vardiya ${slot.index + 1} - ${slot.label}`,
                description: slot.range,
                value: slot.id,
                emoji: slot.emoji
            })));

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_submit_${date}`)
                .setLabel('Seçimimi Onayla')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`daily_excuse_${date}`)
                .setLabel('Mazeret Belirt')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝')
        );

        await user.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(select), buttons]
        });
        this.logger.info(`${user.username} kullanıcısına ${date} günlük anketi gönderildi.`);
    }

    async sendSurveyToAllMods(period) {
        const activeModerators = await this.database.getActiveModerators();
        const punishedIds = new Set((await this.database.getPunishedUsers()).map(item => item.user_id));
        const moderators = activeModerators.filter(mod => !punishedIds.has(mod.user_id));
        let sent = 0;
        let failed = 0;

        for (const mod of moderators) {
            try {
                const user = await this.client.users.fetch(mod.user_id);
                await this.sendSurveyDM(user, period);
                await this.database.recordSurveyDelivery(period, mod.user_id, 'sent');
                sent += 1;
            } catch (error) {
                failed += 1;
                await this.database.recordSurveyDelivery(period, mod.user_id, 'failed', error.message).catch(() => {});
                this.logger.warn(`${mod.username} kullanıcısına anket gönderilemedi: ${error.message}`);
            }
            if (moderators.length > 1) await new Promise(resolve => setTimeout(resolve, 350));
        }

        return { sent, failed };
    }

    async sendSurveyDM(user, period) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🗓️ Moderatör Çalışma Takvimi Anketi')
            .setDescription(`**${period}** dönemi için çalışma saatlerinizi belirtin.`)
            .addFields(
                { name: '📋 İşlem', value: 'Müsait olduğunuz saatleri seçin ve ardından onaylayın.' },
                { name: '⏰ Süre', value: `${this.config.schedule.responseTimeoutHours} saat` }
            )
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId(`time_select_${period}`)
            .setPlaceholder('Müsait olduğunuz saat aralıklarını seçin...')
            .setMinValues(1)
            .setMaxValues(this.config.timeSlots.length)
            .addOptions(this.config.timeSlots.map(slot => ({
                label: slot,
                description: `${slot} saatleri arası`,
                value: slot,
                emoji: '🕐'
            })));

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_availability_${period}`)
                .setLabel('Seçimimi Onayla')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`not_available_${period}`)
                .setLabel('Müsait Değilim')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        await user.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(select), buttons]
        });
    }

    async handleSelection(interaction, period) {
        const key = this.selectionKey(interaction.user.id, period);
        const savedAt = Date.now();
        this.client.surveySelections.set(key, { values: [...interaction.values], savedAt });
        const timer = setTimeout(() => {
            const current = this.client.surveySelections.get(key);
            if (current?.savedAt === savedAt) this.client.surveySelections.delete(key);
        }, 30 * 60 * 1000);
        timer.unref?.();

        const embed = new EmbedBuilder()
            .setColor('#00a86b')
            .setTitle('✅ Seçim Alındı')
            .setDescription('Seçiminizi kaydetmek için **Seçimimi Onayla** butonuna basın.')
            .addFields({
                name: 'Müsait Olduğunuz Vardiyalar',
                value: interaction.values.map(value => `• ${this.formatAvailability(value)}`).join('\n')
            });

        await interaction.update({ embeds: [embed] });
    }

    async ensureSurveyOpen(period) {
        if (isValidDateString(period)) {
            const status = await this.database.getScheduleStatus(period);
            if (!status) return { open: false, reason: 'Bu günlük anket artık aktif değil.' };
            if (status.status !== 'survey_sent') return { open: false, reason: 'Bu günlük anket kapanmış.' };
            if (status.survey_deadline && Date.parse(status.survey_deadline) <= Date.now()) {
                return { open: false, reason: 'Bu günlük anketin yanıt süresi dolmuş.' };
            }
            return { open: true };
        }

        if (/^\d{4}-W\d{2}$/.test(period)) {
            const survey = await this.database.getSurveyPeriod(period);
            if (!survey) return { open: false, reason: 'Bu haftalık anket artık aktif değil.' };
            if (survey.deadline && Date.parse(survey.deadline) <= Date.now()) {
                return { open: false, reason: 'Bu haftalık anketin yanıt süresi dolmuş.' };
            }
        }
        return { open: true };
    }

    async handleConfirm(interaction, period) {
        const open = await this.ensureSurveyOpen(period);
        if (!open.open) {
            await interaction.reply({ content: `❌ ${open.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }
        const key = this.selectionKey(interaction.user.id, period);
        const selection = this.client.surveySelections.get(key);
        if (!selection || selection.values.length === 0) {
            await interaction.reply({ content: '❌ Önce en az bir vardiya seçin.', flags: MessageFlags.Ephemeral });
            return;
        }

        await this.database.saveModResponse(
            interaction.user.id,
            interaction.user.username,
            period,
            selection.values,
            ''
        );
        this.client.surveySelections.delete(key);

        const embed = new EmbedBuilder()
            .setColor('#00a86b')
            .setTitle('✅ Yanıtınız Kaydedildi')
            .setDescription(`**${period}** için müsaitlik yanıtınız kaydedildi.`)
            .addFields({
                name: 'Seçimler',
                value: selection.values.map(value => `• ${this.formatAvailability(value)}`).join('\n')
            })
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
        this.logger.surveyResponse(interaction.user.id, interaction.user.username, period);
    }

    async showExcuseModal(interaction, period, daily = false) {
        const modal = new ModalBuilder()
            .setCustomId(`${daily ? 'daily_excuse_modal_' : 'excuse_modal_'}${period}`)
            .setTitle('Müsait Olmama Sebebi');

        const input = new TextInputBuilder()
            .setCustomId('excuse_text')
            .setLabel('Neden müsait değilsiniz?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Kısa bir açıklama yazın...')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    async handleExcuseModal(interaction, period) {
        const open = await this.ensureSurveyOpen(period);
        if (!open.open) {
            await interaction.reply({ content: `❌ ${open.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }
        const excuse = interaction.fields.getTextInputValue('excuse_text').trim();
        await this.database.saveModResponse(
            interaction.user.id,
            interaction.user.username,
            period,
            [],
            excuse
        );
        this.client.surveySelections.delete(this.selectionKey(interaction.user.id, period));

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('✅ Mazeretiniz Kaydedildi')
                .setDescription(`**${period}** için mazeretiniz kaydedildi.`)
                .addFields({ name: 'Mazeret', value: excuse })
                .setTimestamp()]
        });
        this.logger.surveyResponse(interaction.user.id, interaction.user.username, period);
    }

    formatAvailability(value) {
        const slot = this.slots.find(item => item.id === value);
        return slot ? `${slot.name}` : value;
    }

    async handleInteraction(interaction) {
        const id = interaction.customId || '';

        if (interaction.isStringSelectMenu() && id.startsWith('daily_shift_select_')) {
            return this.handleSelection(interaction, id.slice('daily_shift_select_'.length));
        }
        if (interaction.isButton() && id.startsWith('daily_submit_')) {
            return this.handleConfirm(interaction, id.slice('daily_submit_'.length));
        }
        if (interaction.isButton() && id.startsWith('daily_excuse_')) {
            return this.showExcuseModal(interaction, id.slice('daily_excuse_'.length), true);
        }
        if (interaction.isModalSubmit() && id.startsWith('daily_excuse_modal_')) {
            return this.handleExcuseModal(interaction, id.slice('daily_excuse_modal_'.length));
        }

        if (interaction.isStringSelectMenu() && id.startsWith('time_select_')) {
            return this.handleSelection(interaction, id.slice('time_select_'.length));
        }
        if (interaction.isButton() && id.startsWith('confirm_availability_')) {
            return this.handleConfirm(interaction, id.slice('confirm_availability_'.length));
        }
        if (interaction.isButton() && id.startsWith('not_available_')) {
            return this.showExcuseModal(interaction, id.slice('not_available_'.length), false);
        }
        if (interaction.isModalSubmit() && id.startsWith('excuse_modal_')) {
            return this.handleExcuseModal(interaction, id.slice('excuse_modal_'.length));
        }

        throw new Error(`Desteklenmeyen anket interaction: ${id}`);
    }
}

module.exports = SurveyManager;
