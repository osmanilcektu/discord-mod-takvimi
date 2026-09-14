const SurveyManager = require('../utils/surveyManager');
const SchedulePublisher = require('../utils/schedulePublisher');
const DailyModManager = require('../utils/dailyModManager');
const { isExpiredInteractionError, safeEphemeralReply } = require('../utils/interaction');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        const logger = client.logger;

        try {
            if (interaction.isChatInputCommand()) {
                const now = Date.now();
                const key = `${interaction.user.id}:${interaction.commandName}`;
                const lastUsed = client.cooldowns.get(key) || 0;
                const cooldownMs = 1500;

                if (now - lastUsed < cooldownMs) {
                    await safeEphemeralReply(
                        interaction,
                        '⏱️ Komutu tekrar kullanmadan önce kısa bir süre bekleyin.'
                    );
                    return;
                }

                client.cooldowns.set(key, now);
                setTimeout(() => client.cooldowns.delete(key), cooldownMs + 1000).unref?.();

                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    logger.warn(`Bilinmeyen komut: ${interaction.commandName}`);
                    await safeEphemeralReply(interaction, '❌ Bu komut bulunamadı.');
                    return;
                }

                logger.commandUsed(
                    interaction.commandName,
                    interaction.user.id,
                    interaction.user.username
                );

                await command.execute(interaction, client);
                return;
            }

            if (!(interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit())) {
                return;
            }

            const id = interaction.customId || '';
            const surveyPrefixes = [
                'daily_shift_select_',
                'daily_submit_',
                'daily_excuse_',
                'daily_excuse_modal_',
                'time_select_',
                'confirm_availability_',
                'not_available_',
                'excuse_modal_'
            ];
            const schedulePrefixes = ['refresh_schedule_', 'export_schedule_'];
            const dailyPrefixes = ['reselect_daily_', 'manual_assign_'];

            if (surveyPrefixes.some(prefix => id.startsWith(prefix))) {
                await new SurveyManager(client).handleInteraction(interaction);
                return;
            }

            if (schedulePrefixes.some(prefix => id.startsWith(prefix))) {
                await new SchedulePublisher(client).handleInteraction(interaction);
                return;
            }

            if (dailyPrefixes.some(prefix => id.startsWith(prefix))) {
                await new DailyModManager(client).handleInteraction(interaction);
                return;
            }

            logger.warn(`Bilinmeyen interaction: ${id}`);
            await safeEphemeralReply(interaction, '❌ Bu etkileşim desteklenmiyor.');
        } catch (error) {
            if (isExpiredInteractionError(error)) {
                logger.warn(
                    `Interaction süresi doldu veya daha önce yanıtlandı: ${interaction.id || 'bilinmiyor'}`
                );
                return;
            }

            logger.botError(error, `Interaction: ${interaction.type}`);
            await safeEphemeralReply(
                interaction,
                '❌ İşlem sırasında bir hata oluştu.'
            ).catch(() => {});
        }
    }
};
