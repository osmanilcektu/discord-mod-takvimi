const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DailyModManager = require('../utils/dailyModManager');
const { getLocalTimeString } = require('../utils/dateTime');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Şu anda aktif vardiyada olan moderatörü gösterir'),

    async execute(interaction, client) {
        await interaction.deferReply();
        try {
            const manager = new DailyModManager(client);
            const active = await manager.getCurrentActiveMods();
            const next = await manager.getNextAssignment();
            const currentTime = getLocalTimeString(new Date(), client.config.schedule.timezone);

            const embed = new EmbedBuilder()
                .setColor(active.length > 0 ? '#00a86b' : '#ff9900')
                .setTitle('👮 Aktif Moderatör Vardiyası')
                .setTimestamp();

            if (active.length > 0) {
                const mod = active[0];
                embed.setDescription(`Şu anda aktif moderatör: <@${mod.user_id}> (**${mod.username}**)`)
                    .addFields({
                        name: '🕒 Vardiya',
                        value: `${mod.shift} (${mod.shiftTime})`,
                        inline: true
                    });
            } else {
                embed.setDescription('Şu anda atanmış aktif moderatör bulunmuyor.');
            }

            if (next) {
                embed.addFields({
                    name: '⏭️ Sonraki Vardiya',
                    value: `📅 ${next.date}\n${next.slot.name}\n<@${next.assignment.user_id}> (${next.moderator?.username || 'Bilinmiyor'})`,
                    inline: false
                });
            }

            embed.setFooter({ text: `Saat: ${currentTime} • ${client.config.schedule.timezone}` });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.logger.botError(error, 'Mod komutu');
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Hata')
                    .setDescription('Moderatör vardiyası alınırken bir hata oluştu.')]
            });
        }
    }
};
