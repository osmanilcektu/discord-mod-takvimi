const { ActivityType, Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(readyClient, injectedClient) {
        const client = injectedClient || readyClient;
        client.user.setActivity('Moderatör vardiyalarını yönetiyor', { type: ActivityType.Watching });
        client.logger.info(`✅ ${client.user.tag} olarak giriş yapıldı.`);
        client.logger.info(`🌐 ${client.guilds.cache.size} sunucuda aktif.`);
    }
};
