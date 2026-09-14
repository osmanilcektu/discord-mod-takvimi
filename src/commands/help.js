const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { buildSlots } = require('../utils/slots');
const {
    deferEphemeral,
    isExpiredInteractionError,
    safeEphemeralReply
} = require('../utils/interaction');
const packageJson = require('../../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Bot komutları ve otomatik vardiya sistemi hakkında yardım gösterir'),

    async execute(interaction, client) {
        try {
            const acknowledged = await deferEphemeral(interaction);
            if (!acknowledged) {
                client.logger.warn('Yardım komutu yanıtlanamadan interaction süresi doldu.');
                return;
            }

            const slots = buildSlots(client.config.timeSlots)
                .map(slot => `${slot.emoji} **${slot.id}** — ${slot.range}`)
                .join('\n');

            const scheduler = client.automaticScheduler?.getStatus();
            const schedulerText = scheduler?.autoScheduleEnabled
                ? `Aktif • günlük anket saati ${String(scheduler.dailyScheduleHour).padStart(2, '0')}:00 • yanıt süresi ${scheduler.surveyTimeoutHours} saat`
                : 'Devre dışı';

            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Discord Moderatör Takvim Botu')
                .setDescription('Moderatör vardiyalarını, müsaitlik anketlerini ve iş yükünü yönetir.')
                .setColor('#0099ff')
                .addFields(
                    {
                        name: '👥 /mod',
                        value: 'Şu an aktif vardiyayı/moderatörü ve sıradaki vardiyayı gösterir.',
                        inline: false
                    },
                    {
                        name: '⚙️ /admin',
                        value: [
                            '`takvim-olustur` — günlük anket başlat',
                            '`kullanici-izin` — saat bazlı izin/kısıtlama',
                            '`kalici-saat` — kalıcı vardiya tanımla',
                            '`saat-degistir` — atanmış vardiyayı değiştir',
                            '`mod-ekle` / `modlari-guncelle` — moderatör yönetimi',
                            '`takvim-gonder` — haftalık müsaitlik anketi gönder',
                            '`takvim-yayinla` — haftalık müsaitlik özetini yayınla',
                            '`takvim-sil` — günlük atamaları sil',
                            '`cezali-listesi` / `ban-kaldir` — planlama cezası yönetimi',
                            '`stats` / `permissions` / `workload` — temel sistem durumu',
                            '`sistem-durumu` — ayrıntılı sağlık ve güncelleme raporu',
                            '`guncelleme-kontrol` — GitHub Releases sürüm kontrolü',
                            '`proje-istatistik` — yıldız/fork/release/indirme istatistikleri',
                            '`rapor-gonder` — özel operasyon kanalına rapor gönder',
                            '`mod-listesi` — aktif moderatörleri listele'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '⏱️ Otomatik Sistem',
                        value: schedulerText,
                        inline: false
                    },
                    {
                        name: '🕒 Vardiyalar',
                        value: slots || 'Tanımlı vardiya yok.',
                        inline: false
                    },
                    {
                        name: '🔐 Güvenlik',
                        value: 'Bot tokenını yalnızca `.env` içinde tutun. Token, log veya ekran görüntüsünde paylaşılmamalıdır.',
                        inline: false
                    }
                )
                .setFooter({ text: `v${packageJson.version} • Osman İlçektuğ` })
                .setTimestamp();

            await interaction.editReply({ embeds: [helpEmbed] });
        } catch (error) {
            if (isExpiredInteractionError(error)) {
                client.logger.warn('Yardım komutu interaction süresi dolduğu için yanıtlanamadı.');
                return;
            }

            client.logger.botError(error, 'Yardım komutu');
            await safeEphemeralReply(
                interaction,
                '❌ Yardım bilgileri gösterilirken bir hata oluştu.'
            ).catch(() => {});
        }
    }
};
