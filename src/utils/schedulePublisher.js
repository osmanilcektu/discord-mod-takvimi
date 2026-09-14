const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

class SchedulePublisher {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
    }

    async getTargetChannel() {
        const channelId = this.config.discord.scheduleChannelId || this.config.discord.adminModChannelId;
        if (!channelId) return null;
        const channel = this.client.channels.cache.get(channelId)
            || await this.client.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased?.() ? channel : null;
    }

    async publishSchedule(period) {
        const responses = await this.database.getResponsesForPeriod(period);
        if (responses.length === 0) {
            return { success: false, error: `${period} dönemi için yanıt bulunamadı.` };
        }

        const channel = await this.getTargetChannel();
        if (!channel) return { success: false, error: 'Takvim yayın kanalı bulunamadı veya metin kanalı değil.' };

        const embed = await this.createScheduleEmbed(period, responses);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`refresh_schedule_${period}`)
                .setLabel('Yenile')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId(`export_schedule_${period}`)
                .setLabel('CSV')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊')
        );

        await channel.send({ embeds: [embed], components: [row] });
        this.logger.info(`Haftalık müsaitlik özeti yayınlandı: ${period}`);
        return { success: true, responseCount: responses.length };
    }

    async createScheduleEmbed(period, responses) {
        const allModerators = await this.database.getActiveModerators();
        const respondedIds = new Set(responses.map(response => response.user_id));
        const notResponded = allModerators.filter(mod => !respondedIds.has(mod.user_id));
        const excused = responses.filter(response => Boolean(response.excuse?.trim()));
        const available = responses.filter(response => !response.excuse?.trim() && response.availability?.length > 0);

        const embed = new EmbedBuilder()
            .setColor('#00a86b')
            .setTitle(`📅 Moderatör Müsaitlik Özeti — ${period}`)
            .setDescription('Moderatörlerin bildirdiği müsaitlik durumları.')
            .addFields({
                name: '📊 Genel İstatistikler',
                value: [
                    `👥 Aktif moderatör: **${allModerators.length}**`,
                    `✅ Yanıt veren: **${responses.length}**`,
                    `⚠️ Yanıt vermeyen: **${notResponded.length}**`,
                    `🚫 Mazeretli: **${excused.length}**`,
                    `🟢 Müsaitlik bildiren: **${available.length}**`
                ].join('\n')
            })
            .setTimestamp();

        const slotStats = this.config.timeSlots.map(slot => ({
            slot,
            count: responses.filter(response => Array.isArray(response.availability) && response.availability.includes(slot)).length
        }));
        embed.addFields({
            name: '⏰ Saat Aralıkları',
            value: slotStats.map(item => `**${item.slot}** — ${item.count}`).join('\n').slice(0, 1024)
        });

        const detailLines = responses
            .map(response => {
                if (response.excuse?.trim()) return `🚫 **${response.username}** — ${response.excuse.trim()}`;
                const values = response.availability?.length ? response.availability.join(', ') : 'Müsait değil';
                return `🟢 **${response.username}** — ${values}`.slice(0, 220);
            })
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .slice(0, 30);

        for (const [index, chunk] of this.chunkLines(detailLines, 950).entries()) {
            embed.addFields({
                name: index === 0 ? '👥 Yanıtlar' : `👥 Yanıtlar (${index + 1})`,
                value: chunk
            });
        }

        if (notResponded.length > 0) {
            const lines = notResponded.slice(0, 30).map(mod => `• ${mod.username} (<@${mod.user_id}>)`);
            for (const [index, chunk] of this.chunkLines(lines, 950).entries()) {
                embed.addFields({
                    name: index === 0 ? '⚠️ Yanıt Vermeyenler' : `⚠️ Yanıt Vermeyenler (${index + 1})`,
                    value: chunk
                });
            }
        }

        return embed;
    }

    chunkLines(lines, maxLength = 950) {
        const chunks = [];
        let current = '';
        for (const rawLine of lines) {
            const line = String(rawLine).slice(0, maxLength);
            if (current && current.length + line.length + 1 > maxLength) {
                chunks.push(current);
                current = '';
            }
            current += `${current ? '\n' : ''}${line}`;
        }
        if (current) chunks.push(current);
        return chunks;
    }

    async refreshSchedule(interaction) {
        await interaction.deferUpdate();
        const period = interaction.customId.slice('refresh_schedule_'.length);
        const responses = await this.database.getResponsesForPeriod(period);
        if (responses.length === 0) {
            await interaction.followUp({ content: '❌ Bu dönem için yanıt bulunamadı.', flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.editReply({ embeds: [await this.createScheduleEmbed(period, responses)] });
    }

    csvCell(value) {
        let text = value === null || value === undefined ? '' : String(value);
        if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    generateCSV(responses) {
        const rows = [['Kullanıcı Adı', 'Müsait Saatler', 'Mazeret', 'Yanıt Tarihi']];
        for (const response of responses) {
            rows.push([
                response.username,
                Array.isArray(response.availability) ? response.availability.join('; ') : '',
                response.excuse || '',
                response.responded_at || ''
            ]);
        }
        return `\uFEFF${rows.map(row => row.map(value => this.csvCell(value)).join(',')).join('\n')}`;
    }

    async exportSchedule(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const period = interaction.customId.slice('export_schedule_'.length);
        const responses = await this.database.getResponsesForPeriod(period);
        if (responses.length === 0) {
            await interaction.editReply({ content: '❌ Dışa aktarılacak veri bulunamadı.' });
            return;
        }

        const csv = this.generateCSV(responses);
        await interaction.editReply({
            content: `📊 **${period}** CSV çıktısı`,
            files: [{ attachment: Buffer.from(csv, 'utf8'), name: `moderator_schedule_${period}.csv` }]
        });
    }

    async handleInteraction(interaction) {
        try {
            if (interaction.isButton() && interaction.customId.startsWith('refresh_schedule_')) {
                await this.refreshSchedule(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('export_schedule_')) {
                await this.exportSchedule(interaction);
                return;
            }
            throw new Error(`Desteklenmeyen takvim interaction: ${interaction.customId}`);
        } catch (error) {
            this.logger.botError(error, 'SchedulePublisher interaction');
            const payload = { content: '❌ Takvim işlemi sırasında hata oluştu.', flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
            else await interaction.reply(payload).catch(() => {});
        }
    }
}

module.exports = SchedulePublisher;
