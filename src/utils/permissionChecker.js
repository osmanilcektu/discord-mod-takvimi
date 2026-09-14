const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const REQUIRED_GUILD_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles
];

const PERMISSION_NAMES = new Map([
    [PermissionFlagsBits.ViewChannel, 'Kanal Görüntüleme'],
    [PermissionFlagsBits.SendMessages, 'Mesaj Gönderme'],
    [PermissionFlagsBits.EmbedLinks, 'Embed Bağlantıları'],
    [PermissionFlagsBits.AttachFiles, 'Dosya Ekleme']
]);

class PermissionChecker {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
    }

    async getGuild() {
        return this.client.guilds.cache.get(this.config.discord.guildId)
            || this.client.guilds.fetch(this.config.discord.guildId).catch(() => null);
    }

    async getBotMember(guild) {
        return guild.members.me || guild.members.fetchMe().catch(() => null);
    }

    async checkChannelPermissions(channelId, botMember, requiredPermissions) {
        if (!channelId) {
            return {
                id: null,
                exists: false,
                missing: ['Kanal ID tanımlı değil']
            };
        }

        const channel = this.client.channels.cache.get(channelId)
            || await this.client.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased?.()) {
            return {
                id: channelId,
                exists: false,
                missing: ['Kanal bulunamadı veya metin kanalı değil']
            };
        }

        const permissions = channel.permissionsFor?.(botMember);
        if (!permissions) {
            return {
                id: channelId,
                exists: true,
                name: channel.name || channelId,
                missing: ['Kanal yetkileri okunamadı']
            };
        }

        const missing = requiredPermissions
            .filter(permission => !permissions.has(permission))
            .map(permission => PERMISSION_NAMES.get(permission) || String(permission));

        return {
            id: channelId,
            exists: true,
            name: channel.name || channelId,
            missing
        };
    }

    buildChannelRequirements() {
        const basic = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks
        ];

        const withFiles = [
            ...basic,
            PermissionFlagsBits.AttachFiles
        ];

        const requirements = [
            ['admin', this.config.discord.adminModChannelId, basic],
            ['log', this.config.discord.logChannelId, basic],
            ['schedule', this.config.discord.scheduleChannelId, withFiles]
        ];

        if (this.config.project.reportingEnabled) {
            requirements.push(['report', this.config.project.reportChannelId, basic]);
        }

        if (this.config.project.updateCheckEnabled) {
            requirements.push(['update', this.config.project.updateChannelId, basic]);
        }

        return requirements;
    }

    async checkBotPermissions() {
        try {
            const guild = await this.getGuild();
            if (!guild) throw new Error('Yapılandırılmış Discord sunucusu bulunamadı.');

            const botMember = await this.getBotMember(guild);
            if (!botMember) throw new Error('Bot üye bilgisi alınamadı.');

            const missingPermissions = REQUIRED_GUILD_PERMISSIONS
                .filter(permission => !botMember.permissions.has(permission))
                .map(permission => PERMISSION_NAMES.get(permission));

            const hasPermissions = REQUIRED_GUILD_PERMISSIONS
                .filter(permission => botMember.permissions.has(permission))
                .map(permission => PERMISSION_NAMES.get(permission));

            const grouped = new Map();
            for (const [purpose, channelId, required] of this.buildChannelRequirements()) {
                const existing = grouped.get(channelId);
                if (existing) {
                    existing.purposes.push(purpose);
                    for (const permission of required) existing.required.add(permission);
                    continue;
                }

                grouped.set(channelId, {
                    channelId,
                    purposes: [purpose],
                    required: new Set(required)
                });
            }

            const channels = {};
            const channelProblems = [];

            for (const group of grouped.values()) {
                const result = await this.checkChannelPermissions(
                    group.channelId,
                    botMember,
                    [...group.required]
                );

                const key = group.purposes.join('+');
                channels[key] = result;

                if (!result.exists || result.missing.length > 0) {
                    const channelLabel = result.name
                        ? `#${result.name} (${result.id})`
                        : String(result.id || 'tanımsız');
                    channelProblems.push(
                        `${group.purposes.join('/')} → ${channelLabel}: ${result.missing.join(', ')}`
                    );
                }
            }

            const result = {
                success: channelProblems.length === 0,
                hasPermissions,
                missingPermissions,
                channelProblems,
                channels,
                guild: guild.name,
                botNickname: botMember.displayName
            };

            this.logger.info(
                `Yetki kontrolü tamamlandı. Genel eksik: ${missingPermissions.length}, kanal sorunu: ${channelProblems.length}`
            );
            return result;
        } catch (error) {
            this.logger.botError(error, 'Bot yetki kontrolü');
            return {
                success: false,
                error: error.message,
                hasPermissions: [],
                missingPermissions: [],
                channelProblems: [],
                channels: {}
            };
        }
    }

    createPermissionReport(result) {
        const embed = new EmbedBuilder()
            .setTitle('🔐 Bot Yetki Durumu')
            .setColor(result.success ? '#00aa55' : '#cc3333')
            .setDescription(
                result.success
                    ? '✅ Yapılandırılmış kanallardaki etkin bot izinleri uygun.'
                    : '❌ Düzeltilmesi gereken kanal erişimi veya etkin izin var.'
            )
            .setTimestamp();

        if (result.error) {
            embed.addFields({
                name: 'Hata',
                value: result.error.slice(0, 1024)
            });
            return embed;
        }

        embed.addFields({
            name: 'Sunucu',
            value: `${result.guild || 'Bilinmiyor'}\nBot: ${result.botNickname || this.client.user?.username || 'Bilinmiyor'}`,
            inline: false
        });

        if (result.hasPermissions.length > 0) {
            embed.addFields({
                name: '✅ Mevcut temel yetkiler',
                value: result.hasPermissions.join('\n').slice(0, 1024)
            });
        }

        if (result.missingPermissions.length > 0) {
            embed.addFields({
                name: 'ℹ️ Sunucu tabanında eksik izinler',
                value: `${result.missingPermissions.join('\n')}\n\nKanal izinleri/overwrite bu eksikleri telafi edebilir; başarı durumu etkin kanal izinlerine göre hesaplanır.`.slice(0, 1024)
            });
        }

        if (result.channelProblems.length > 0) {
            embed.addFields({
                name: '⚠️ Kanal erişimleri',
                value: result.channelProblems.join('\n').slice(0, 1024)
            });
        }

        return embed;
    }

    async sendPermissionAlert() {
        const result = await this.checkBotPermissions();
        if (result.success || !this.client.isReady()) return result;

        try {
            const channel = await this.client.channels.fetch(
                this.config.discord.adminModChannelId
            );

            if (channel?.isTextBased?.()) {
                await channel.send({
                    content: '⚠️ **Bot yetki/kanal erişimi kontrolü başarısız.**',
                    embeds: [this.createPermissionReport(result)]
                });
            }
        } catch (error) {
            this.logger.warn(`Yetki uyarısı gönderilemedi: ${error.message}`);
        }

        return result;
    }

    async hasPermission(permission) {
        const guild = await this.getGuild();
        if (!guild) return false;
        const botMember = await this.getBotMember(guild);
        return Boolean(botMember?.permissions.has(permission));
    }

    async hasAdminChannelPermission(permission) {
        const guild = await this.getGuild();
        if (!guild) return false;
        const botMember = await this.getBotMember(guild);
        if (!botMember) return false;

        const channel = await this.client.channels.fetch(
            this.config.discord.adminModChannelId
        ).catch(() => null);

        return Boolean(channel?.permissionsFor?.(botMember)?.has(permission));
    }
}

module.exports = PermissionChecker;
