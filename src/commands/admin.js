const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const AutoScheduleManager = require('../utils/autoScheduleManager');
const SurveyManager = require('../utils/surveyManager');
const PermissionChecker = require('../utils/permissionChecker');
const SchedulePublisher = require('../utils/schedulePublisher');
const { buildSlots } = require('../utils/slots');
const { getLocalDateString, isValidDateString, parseClock } = require('../utils/dateTime');
const appConfig = require('../utils/config');

function slotChoices() {
    return buildSlots(appConfig.timeSlots).map(slot => ({
        name: `${slot.emoji} ${slot.name} (${slot.range})`.slice(0, 100),
        value: slot.id
    }));
}

function modRoleChoices() {
    return appConfig.discord.modRoles.slice(0, 25).map(role => ({
        name: role.slice(0, 100),
        value: role.slice(0, 100)
    }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Moderatör takvimi yönetim komutları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('takvim-olustur')
            .setDescription('Belirli tarih için günlük müsaitlik anketini başlatır')
            .addStringOption(option => option.setName('tarih').setDescription('YYYY-MM-DD; boşsa bugün').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('kullanici-izin')
            .setDescription('Kullanıcıya saat bazlı izin/kısıtlama ekler')
            .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
            .addStringOption(option => option.setName('baslangic').setDescription('HH:MM').setRequired(true))
            .addStringOption(option => option.setName('bitis').setDescription('HH:MM veya 24:00').setRequired(true))
            .addStringOption(option => option.setName('tur').setDescription('İzin türü').setRequired(true).addChoices(
                { name: '✅ İzin ver', value: 'allow' },
                { name: '❌ Kısıtla', value: 'restrict' }
            ))
            .addStringOption(option => option.setName('aciklama').setDescription('Açıklama').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('kalici-saat')
            .setDescription('Kullanıcıya kalıcı vardiya atar')
            .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
            .addStringOption(option => option.setName('vardiya').setDescription('Vardiya').setRequired(true).addChoices(...slotChoices()))
            .addStringOption(option => option.setName('aciklama').setDescription('Açıklama').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('saat-degistir')
            .setDescription('Kullanıcının atanmış vardiyasını değiştirir')
            .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
            .addStringOption(option => option.setName('yeni-vardiya').setDescription('Yeni vardiya').setRequired(true).addChoices(...slotChoices()))
            .addStringOption(option => option.setName('tarih').setDescription('YYYY-MM-DD; boşsa bugün').setRequired(false))
            .addStringOption(option => option.setName('sebep').setDescription('Değişiklik sebebi').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('mod-ekle')
            .setDescription('Sisteme moderatör ekler')
            .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
            .addStringOption(option => option.setName('rol').setDescription('Yapılandırılmış moderatör rolü').setRequired(true).addChoices(...modRoleChoices())))
        .addSubcommand(sub => sub.setName('modlari-guncelle').setDescription('Sunucudaki moderatör rollerini yeniden tarar'))
        .addSubcommand(sub => sub
            .setName('takvim-gonder')
            .setDescription('Haftalık müsaitlik anketini moderatörlere gönderir')
            .addStringOption(option => option.setName('period').setDescription('Örn. 2026-W37').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('takvim-yayinla')
            .setDescription('Haftalık müsaitlik özetini takvim kanalında yayınlar')
            .addStringOption(option => option.setName('period').setDescription('Örn. 2026-W37').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('takvim-sil')
            .setDescription('Belirtilen tarihin günlük vardiya takvimini siler')
            .addStringOption(option => option.setName('tarih').setDescription('YYYY-MM-DD').setRequired(true)))
        .addSubcommand(sub => sub.setName('cezali-listesi').setDescription('Aktif planlama cezası olan kullanıcıları listeler'))
        .addSubcommand(sub => sub
            .setName('ban-kaldir')
            .setDescription('Kullanıcının aktif planlama cezasını kaldırır')
            .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
        .addSubcommand(sub => sub.setName('stats').setDescription('Bot istatistiklerini gösterir'))
        .addSubcommand(sub => sub.setName('permissions').setDescription('Bot Discord yetkilerini kontrol eder'))
        .addSubcommand(sub => sub.setName('workload').setDescription('Son 7 günlük moderatör iş yükünü gösterir'))
        .addSubcommand(sub => sub.setName('sistem-durumu').setDescription('Ayrıntılı bot, scheduler ve güncelleme durumunu gösterir'))
        .addSubcommand(sub => sub.setName('guncelleme-kontrol').setDescription('GitHub Releases üzerinden yeni sürüm kontrolü yapar'))
        .addSubcommand(sub => sub.setName('proje-istatistik').setDescription('GitHub yıldız, fork, release ve indirme sayılarını gösterir'))
        .addSubcommand(sub => sub.setName('rapor-gonder').setDescription('Operasyon raporunu yapılandırılmış özel kanala gönderir'))
        .addSubcommand(sub => sub.setName('mod-listesi').setDescription('Aktif moderatörleri ve rollerini listeler')),

    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Bu komut için yönetici yetkisi gerekir.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();

        try {
            const handlers = {
                'takvim-olustur': this.handleCreateSchedule,
                'kullanici-izin': this.handleUserPermission,
                'kalici-saat': this.handlePermanentShift,
                'saat-degistir': this.handleChangeShift,
                'mod-ekle': this.handleAddMod,
                'modlari-guncelle': this.handleUpdateMods,
                'takvim-gonder': this.handleSendSurvey,
                'takvim-yayinla': this.handlePublishSurvey,
                'takvim-sil': this.handleDeleteSchedule,
                'cezali-listesi': this.handlePunishedList,
                'ban-kaldir': this.handleUnban,
                stats: this.handleStats,
                permissions: this.handlePermissions,
                workload: this.handleWorkload,
                'sistem-durumu': this.handleSystemStatus,
                'guncelleme-kontrol': this.handleUpdateCheck,
                'proje-istatistik': this.handleProjectStats,
                'rapor-gonder': this.handleSendReport,
                'mod-listesi': this.handleModList
            };

            const handler = handlers[sub];
            if (!handler) throw new Error(`Bilinmeyen alt komut: ${sub}`);
            await handler.call(this, interaction, client);
        } catch (error) {
            client.logger.botError(error, `Admin/${sub}`);
            await interaction.editReply({ content: `❌ İşlem başarısız: ${error.message}` });
        }
    },

    getDateOption(interaction, client, name = 'tarih') {
        const value = interaction.options.getString(name)
            || getLocalDateString(new Date(), client.config.schedule.timezone);
        if (!isValidDateString(value)) throw new Error('Tarih YYYY-MM-DD formatında ve geçerli olmalıdır.');
        return value;
    },

    async handleCreateSchedule(interaction, client) {
        const date = this.getDateOption(interaction, client);
        const result = await new AutoScheduleManager(client).createDailySchedule(date);
        await interaction.editReply({
            content: result.success
                ? `✅ **${date}** için anket başlatıldı.\n${result.summary || ''}`
                : `❌ ${result.error}`
        });
    },

    async handleUserPermission(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const start = interaction.options.getString('baslangic');
        const end = interaction.options.getString('bitis');
        const type = interaction.options.getString('tur');
        const description = interaction.options.getString('aciklama') || '';

        const startMinutes = parseClock(start);
        const endMinutes = parseClock(end);
        if (startMinutes === null || endMinutes === null || startMinutes >= 1440 || startMinutes === endMinutes) {
            throw new Error('Saatler HH:MM formatında olmalı; bitiş için 24:00 kullanılabilir.');
        }

        await client.database.setUserTimePermission(user.id, start, end, type, description);
        await interaction.editReply({
            content: `✅ **${user.username}** için ${start}-${end} aralığı **${type === 'allow' ? 'izin' : 'kısıtlama'}** olarak kaydedildi.`
        });
    },

    async handlePermanentShift(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const shiftId = interaction.options.getString('vardiya');
        const description = interaction.options.getString('aciklama') || '';
        const slot = buildSlots(client.config.timeSlots).find(item => item.id === shiftId);
        if (!slot) throw new Error('Geçersiz vardiya.');

        const existing = await client.database.getModerator(user.id);
        if (!existing) {
            await client.database.addModerator(user.id, user.username, user.globalName || user.username, []);
        }
        await client.database.setPermanentShift(user.id, shiftId, description);
        await interaction.editReply({ content: `✅ **${user.username}** için kalıcı vardiya ayarlandı:\n${slot.name}` });
    },

    async handleChangeShift(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const shiftId = interaction.options.getString('yeni-vardiya');
        const date = this.getDateOption(interaction, client);
        const reason = interaction.options.getString('sebep') || 'Admin tarafından değiştirildi';
        const slot = buildSlots(client.config.timeSlots).find(item => item.id === shiftId);
        if (!slot) throw new Error('Geçersiz vardiya.');

        const result = await client.database.changeUserShift(user.id, shiftId, date, reason);
        if (!result.success) throw new Error(result.error);

        try {
            const dmUser = await client.users.fetch(user.id);
            await dmUser.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🔄 Vardiya Değişikliği')
                    .setDescription(`**${date}** tarihli vardiyanız değiştirildi.`)
                    .addFields(
                        { name: '🕒 Yeni Vardiya', value: slot.name },
                        { name: '📝 Sebep', value: reason }
                    )
                    .setTimestamp()]
            });
        } catch (error) {
            client.logger.warn(`${user.username} kullanıcısına vardiya DM'i gönderilemedi: ${error.message}`);
        }

        await interaction.editReply({ content: `✅ **${user.username}** → ${slot.name}` });
    },

    async handleAddMod(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const role = interaction.options.getString('rol');
        let displayName = user.globalName || user.username;
        try {
            const guild = client.guilds.cache.get(client.config.discord.guildId);
            const member = guild ? await guild.members.fetch(user.id) : null;
            if (member) displayName = member.displayName;
        } catch {}

        await client.database.addModerator(user.id, user.username, displayName, [role]);
        await interaction.editReply({ content: `✅ **${user.username}** sisteme **${role}** rolü ile eklendi.` });
    },

    async handleUpdateMods(interaction, client) {
        const guild = client.guilds.cache.get(client.config.discord.guildId)
            || await client.guilds.fetch(client.config.discord.guildId).catch(() => null);
        if (!guild) throw new Error('Discord sunucusu bulunamadı.');

        await guild.members.fetch();
        const activeIds = [];
        for (const member of guild.members.cache.values()) {
            if (member.user.bot) continue;
            const roles = member.roles.cache.map(role => role.name)
                .filter(role => client.config.discord.modRoles.includes(role));
            if (roles.length === 0) continue;
            activeIds.push(member.id);
            await client.database.updateModerator(member.id, member.user.username, member.displayName, roles);
        }
        await client.database.deactivateMissingModerators(activeIds);
        await interaction.editReply({ content: `✅ **${activeIds.length}** moderatör güncellendi.` });
    },

    async handleSendSurvey(interaction, client) {
        const period = interaction.options.getString('period') || client.config.utils.getCurrentPeriod();
        if (!/^\d{4}-W\d{2}$/.test(period)) throw new Error('Dönem formatı YYYY-Www olmalıdır. Örn: 2026-W37');

        const now = new Date();
        const deadline = new Date(now.getTime() + client.config.schedule.responseTimeoutHours * 3600000);
        const end = new Date(now.getTime() + 7 * 86400000);
        await client.database.saveSurveyPeriod(period, now.toISOString(), end.toISOString(), deadline.toISOString());

        const result = await new SurveyManager(client).sendSurveyToAllMods(period);
        if (result.sent === 0) {
            await interaction.editReply({
                content: '⚠️ Anket hiçbir moderatöre teslim edilemedi. Moderatör listesini ve kullanıcıların DM izinlerini kontrol edin.'
            });
            return;
        }
        await interaction.editReply({
            content: `✅ **${period}** anketi gönderildi. Başarılı: **${result.sent}**, başarısız: **${result.failed}**.`
        });
    },

    async handlePublishSurvey(interaction, client) {
        const period = interaction.options.getString('period') || client.config.utils.getCurrentPeriod();
        if (!/^\d{4}-W\d{2}$/.test(period)) throw new Error('Dönem formatı YYYY-Www olmalıdır. Örn: 2026-W37');
        const result = await new SchedulePublisher(client).publishSchedule(period);
        if (!result.success) {
            await interaction.editReply({ content: `ℹ️ ${result.error}` });
            return;
        }
        await interaction.editReply({ content: `✅ **${period}** müsaitlik özeti takvim kanalında yayınlandı. Yanıt: ${result.responseCount}.` });
    },

    async handleDeleteSchedule(interaction, client) {
        const date = this.getDateOption(interaction, client);
        const count = await client.database.deleteScheduleForDate(date);
        await interaction.editReply({ content: `✅ **${date}** takvimi silindi. Silinen atama: ${count}.` });
    },

    async handlePunishedList(interaction, client) {
        const users = await client.database.getPunishedUsers();
        if (users.length === 0) {
            await interaction.editReply({ content: '✅ Aktif planlama cezası bulunmuyor.' });
            return;
        }

        const text = users.slice(0, 20).map(user => {
            const end = new Date(user.punishment_end).toLocaleString('tr-TR', { timeZone: client.config.schedule.timezone });
            return `**${user.username}** <@${user.user_id}>\nSebep: ${user.reason} • Ceza: ${user.punishment_type} • Bitiş: ${end}`;
        }).join('\n\n');

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Aktif Planlama Cezaları')
                .setDescription(text)
                .setFooter({ text: `Toplam: ${users.length}` })
                .setTimestamp()]
        });
    },

    async handleUnban(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const result = await client.database.removeBan(user.id);
        if (!result.success) throw new Error(result.error);

        try {
            await (await client.users.fetch(user.id)).send('✅ Planlama cezanız yönetici tarafından kaldırıldı.');
        } catch (error) {
            client.logger.warn(`${user.username} kullanıcısına ceza kaldırma DM'i gönderilemedi: ${error.message}`);
        }
        await interaction.editReply({ content: `✅ **${user.username}** kullanıcısının aktif planlama cezası kaldırıldı.` });
    },

    async handleStats(interaction, client) {
        const activeMods = await client.database.getActiveModerators();
        const punished = await client.database.getPunishedUsers();
        const uptime = process.uptime();
        const uptimeText = `${Math.floor(uptime / 86400)}g ${Math.floor((uptime % 86400) / 3600)}s ${Math.floor((uptime % 3600) / 60)}dk`;
        const scheduler = client.automaticScheduler?.getStatus();

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Bot İstatistikleri')
                .addFields(
                    { name: 'Çalışma Süresi', value: uptimeText, inline: true },
                    { name: 'Aktif Moderatör', value: String(activeMods.length), inline: true },
                    { name: 'Aktif Ceza', value: String(punished.length), inline: true },
                    { name: 'Node.js', value: process.version, inline: true },
                    { name: 'Discord.js', value: require('discord.js').version, inline: true },
                    { name: 'Scheduler', value: scheduler?.isRunning ? `✅ ${scheduler.taskCount} görev` : '❌', inline: true }
                )
                .setTimestamp()]
        });
    },

    async handlePermissions(interaction, client) {
        const checker = new PermissionChecker(client);
        const result = await checker.checkBotPermissions();
        await interaction.editReply({ embeds: [checker.createPermissionReport(result)] });
    },

    async handleWorkload(interaction, client) {
        const moderators = await client.database.getActiveModerators();
        if (moderators.length === 0) {
            await interaction.editReply({ content: 'ℹ️ Aktif moderatör bulunmuyor.' });
            return;
        }

        const slots = buildSlots(client.config.timeSlots);
        const today = getLocalDateString(new Date(), client.config.schedule.timezone);
        const [year, month, day] = today.split('-').map(Number);
        const rows = [];

        for (const mod of moderators) {
            let totalHours = 0;
            let totalDays = 0;
            for (let offset = 0; offset < 7; offset += 1) {
                const date = new Date(Date.UTC(year, month - 1, day));
                date.setUTCDate(date.getUTCDate() - offset);
                const dateString = date.toISOString().slice(0, 10);
                const assignments = await client.database.getUserAssignmentsForDate(mod.user_id, dateString);
                if (assignments.length > 0) totalDays += 1;
                totalHours += assignments.reduce((sum, assignment) => {
                    return sum + (slots.find(slot => slot.id === assignment.slot_id)?.hours || 0);
                }, 0);
            }
            rows.push({ username: mod.username, totalHours, totalDays });
        }

        rows.sort((a, b) => b.totalHours - a.totalHours || a.username.localeCompare(b.username, 'tr'));
        const description = rows.slice(0, 20).map((row, index) =>
            `${index + 1}. **${row.username}** — ${row.totalHours} saat / ${row.totalDays} gün`
        ).join('\n');

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Son 7 Günlük İş Yükü')
                .setDescription(description || 'Veri yok.')
                .setTimestamp()]
        });
    },

    async handleSystemStatus(interaction, client) {
        if (!client.projectMonitor) throw new Error('Proje izleme servisi hazır değil.');
        const embed = await client.projectMonitor.buildSystemStatusEmbed({ includeUpdate: true });
        await interaction.editReply({ embeds: [embed] });
    },

    async handleUpdateCheck(interaction, client) {
        if (!client.projectMonitor) throw new Error('Proje izleme servisi hazır değil.');
        const status = await client.projectMonitor.getUpdateStatus({ force: true });
        await interaction.editReply({ embeds: [client.projectMonitor.buildUpdateEmbed(status)] });
    },

    async handleProjectStats(interaction, client) {
        if (!client.projectMonitor) throw new Error('Proje izleme servisi hazır değil.');
        const stats = await client.projectMonitor.getProjectStats();
        const latest = stats.latestRelease?.tag_name || 'Release yok';
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#24292F')
                .setTitle('📦 GitHub Proje İstatistikleri')
                .setDescription(`**${stats.repository}**`)
                .addFields(
                    { name: '⭐ Yıldız', value: String(stats.stars), inline: true },
                    { name: '🍴 Fork', value: String(stats.forks), inline: true },
                    { name: '🐛 Açık Issue', value: String(stats.openIssues), inline: true },
                    { name: '👀 Watcher', value: String(stats.watchers), inline: true },
                    { name: '🏷️ Release', value: String(stats.releases), inline: true },
                    { name: '📎 Release Asset', value: String(stats.releaseAssets), inline: true },
                    { name: '⬇️ Asset İndirmeleri', value: String(stats.totalDownloads), inline: true },
                    { name: '📦 Asset Boyutu', value: require('../utils/versionUtils').formatBytes(stats.totalAssetBytes), inline: true },
                    { name: 'Son Release', value: latest, inline: true },
                    { name: 'GitHub', value: stats.url, inline: false }
                )
                .setFooter({ text: 'İndirme sayısı yalnızca GitHub Release asset dosyalarını kapsar.' })
                .setTimestamp()]
        });
    },

    async handleSendReport(interaction, client) {
        if (!client.projectMonitor) throw new Error('Proje izleme servisi hazır değil.');
        const result = await client.projectMonitor.sendOperationalReport(`manuel • ${interaction.user.username}`);
        if (!result.sent) throw new Error(result.reason);
        await interaction.editReply({ content: `✅ Operasyon raporu <#${result.channelId}> kanalına gönderildi.` });
    },

    async handleModList(interaction, client) {
        const moderators = await client.database.getActiveModerators();
        if (moderators.length === 0) {
            await interaction.editReply({ content: 'ℹ️ Aktif moderatör bulunmuyor.' });
            return;
        }
        const rows = moderators.slice(0, 25).map((mod, index) => {
            const roles = Array.isArray(mod.roles) && mod.roles.length > 0 ? mod.roles.join(', ') : 'Rol bilgisi yok';
            return `${index + 1}. <@${mod.user_id}> — **${mod.display_name || mod.username}**\n${roles}`;
        });
        const suffix = moderators.length > 25 ? `\n\n…ve ${moderators.length - 25} moderatör daha.` : '';
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`👥 Aktif Moderatörler (${moderators.length})`)
                .setDescription(rows.join('\n') + suffix)
                .setTimestamp()]
        });
    }

};
