const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'error',
    async execute(error, client) {
        const safeError = error instanceof Error ? error : new Error(String(error));
        client.logger.botError(safeError, 'Discord Client Error');

        try {
            if (!client.isReady()) return;
            const channelId = client.config.discord.adminModChannelId;
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased?.()) return;

            const embed = new EmbedBuilder()
                .setColor('#cc3333')
                .setTitle('🚨 Discord Client Hatası')
                .setDescription('Discord istemcisinde bir hata oluştu. Ayrıntılar sunucu loglarına kaydedildi.')
                .addFields({ name: 'Hata', value: (safeError.message || 'Bilinmeyen hata').slice(0, 1000) })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (notificationError) {
            client.logger.warn(`Admin kanalına hata bildirimi gönderilemedi: ${notificationError.message}`);
        }
    }
};
