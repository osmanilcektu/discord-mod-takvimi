const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const packageJson = require('../../package.json');

const { compareVersions, formatBytes, formatUptime } = require('./versionUtils');

class ProjectMonitor {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.interval = null;
        this.dailyTask = null;
        this.started = false;
        this.lastNotifiedVersion = null;
        this.lastRelease = null;
        this.lastReleaseCheckedAt = null;
    }

    get repository() {
        return this.config.project.repository;
    }

    get currentVersion() {
        return packageJson.version;
    }

    async fetchJson(pathname) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        timer.unref?.();

        try {
            const response = await fetch(`https://api.github.com${pathname}`, {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'User-Agent': `discord-mod-takvimi/${this.currentVersion}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                signal: controller.signal
            });

            if (response.status === 404) return null;
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`GitHub API ${response.status}: ${text.slice(0, 200) || response.statusText}`);
            }
            return response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async getLatestRelease({ force = false } = {}) {
        const cacheAgeMs = this.lastReleaseCheckedAt
            ? Date.now() - this.lastReleaseCheckedAt
            : Number.POSITIVE_INFINITY;

        if (!force && this.lastRelease && cacheAgeMs < 5 * 60 * 1000) {
            return this.lastRelease;
        }

        const release = await this.fetchJson(`/repos/${this.repository}/releases/latest`);
        this.lastRelease = release;
        this.lastReleaseCheckedAt = Date.now();
        return release;
    }

    async getUpdateStatus({ force = false } = {}) {
        const release = await this.getLatestRelease({ force });
        if (!release) {
            return {
                currentVersion: this.currentVersion,
                latestVersion: null,
                updateAvailable: false,
                release: null
            };
        }

        const latestVersion = String(release.tag_name || release.name || '').trim();
        return {
            currentVersion: this.currentVersion,
            latestVersion,
            updateAvailable: compareVersions(latestVersion, this.currentVersion) > 0,
            release
        };
    }

    async getProjectStats() {
        const [repo, releases] = await Promise.all([
            this.fetchJson(`/repos/${this.repository}`),
            this.fetchJson(`/repos/${this.repository}/releases?per_page=100`)
        ]);

        if (!repo) throw new Error('GitHub deposu bulunamadı. GITHUB_REPOSITORY değerini kontrol edin.');
        const releaseList = Array.isArray(releases) ? releases : [];
        const assets = releaseList.flatMap(release => Array.isArray(release.assets) ? release.assets : []);
        const totalDownloads = assets.reduce((sum, asset) => sum + (Number(asset.download_count) || 0), 0);
        const totalAssetBytes = assets.reduce((sum, asset) => sum + (Number(asset.size) || 0), 0);

        return {
            repository: repo.full_name,
            url: repo.html_url,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            openIssues: repo.open_issues_count || 0,
            watchers: repo.subscribers_count ?? repo.watchers_count ?? 0,
            releases: releaseList.filter(release => !release.draft).length,
            releaseAssets: assets.length,
            totalDownloads,
            totalAssetBytes,
            latestRelease: releaseList.find(release => !release.draft && !release.prerelease) || null
        };
    }

    async getReportChannel() {
        const channelId = this.config.project.reportChannelId;
        if (!channelId) return null;
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased?.() ? channel : null;
    }

    async getUpdateChannel() {
        const channelId = this.config.project.updateChannelId;
        if (!channelId) return null;
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased?.() ? channel : null;
    }

    async buildSystemStatusEmbed({ includeUpdate = true } = {}) {
        const [activeMods, punished] = await Promise.all([
            this.client.database.getActiveModerators(),
            this.client.database.getPunishedUsers()
        ]);
        const scheduler = this.client.automaticScheduler?.getStatus();
        const guild = this.client.guilds.cache.get(this.config.discord.guildId)
            || await this.client.guilds.fetch(this.config.discord.guildId).catch(() => null);
        const memory = process.memoryUsage();

        let updateText = 'Kontrol edilmedi';
        if (includeUpdate && this.config.project.updateCheckEnabled) {
            try {
                const status = await this.getUpdateStatus({ force: false });
                updateText = status.latestVersion
                    ? (status.updateAvailable
                        ? `⬆️ ${status.latestVersion} mevcut`
                        : `✅ Güncel (${status.currentVersion})`)
                    : `ℹ️ GitHub Release bulunamadı (${status.currentVersion})`;
            } catch (error) {
                updateText = `⚠️ Kontrol başarısız: ${error.message.slice(0, 80)}`;
            }
        }

        return new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🩺 ModTakvim Sistem Raporu')
            .addFields(
                { name: 'Sürüm', value: `v${this.currentVersion}`, inline: true },
                { name: 'Çalışma Süresi', value: formatUptime(process.uptime()), inline: true },
                { name: 'Sunucu', value: guild ? `${guild.name}\n${guild.id}` : '❌ Erişilemiyor', inline: false },
                { name: 'Aktif Moderatör', value: String(activeMods.length), inline: true },
                { name: 'Aktif Ceza', value: String(punished.length), inline: true },
                { name: 'Scheduler', value: scheduler?.isRunning ? `✅ ${scheduler.taskCount} görev` : '⏸️ Kapalı', inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'discord.js', value: require('discord.js').version, inline: true },
                { name: 'Bellek', value: `${formatBytes(memory.rss)} RSS`, inline: true },
                { name: 'Güncelleme', value: updateText, inline: false },
                { name: 'Raporlama', value: this.config.project.reportingEnabled ? '✅ Açık' : '⏸️ Kapalı', inline: true },
                { name: 'Otomatik Güncelleme Bildirimi', value: this.config.project.updateCheckEnabled ? '✅ Açık' : '⏸️ Kapalı', inline: true }
            )
            .setTimestamp();
    }

    buildUpdateEmbed(status) {
        if (!status.release) {
            return new EmbedBuilder()
                .setColor('#F0B232')
                .setTitle('ℹ️ Güncelleme Kontrolü')
                .setDescription(`GitHub üzerinde yayınlanmış bir Release bulunamadı.\nMevcut sürüm: **v${status.currentVersion}**`)
                .setTimestamp();
        }

        const release = status.release;
        const publishedAt = release.published_at
            ? new Date(release.published_at).toLocaleString('tr-TR', { timeZone: this.config.schedule.timezone })
            : 'Bilinmiyor';

        return new EmbedBuilder()
            .setColor(status.updateAvailable ? '#F0B232' : '#57F287')
            .setTitle(status.updateAvailable ? '⬆️ Yeni ModTakvim sürümü mevcut' : '✅ ModTakvim güncel')
            .setDescription(status.updateAvailable
                ? `**v${status.currentVersion} → ${status.latestVersion}**\nGüncelleme kendiliğinden kurulmaz; yönetici onayı gerekir.`
                : `Mevcut sürüm **v${status.currentVersion}** en güncel sürüm.`)
            .addFields(
                { name: 'Yayın', value: status.latestVersion || 'Bilinmiyor', inline: true },
                { name: 'Yayın Tarihi', value: publishedAt, inline: true },
                { name: 'Release', value: release.html_url || `https://github.com/${this.repository}/releases`, inline: false }
            )
            .setTimestamp();
    }

    async notifyUpdateIfNeeded({ forceNotify = false } = {}) {
        if (!this.config.project.updateCheckEnabled) return null;
        const status = await this.getUpdateStatus({ force: true });
        if (!status.updateAvailable) return status;
        if (!forceNotify && this.lastNotifiedVersion === status.latestVersion) return status;

        const channel = await this.getUpdateChannel();
        if (!channel) {
            this.logger.warn('Güncelleme bulundu fakat UPDATE_CHANNEL_ID kanalına erişilemedi.');
            return status;
        }

        await channel.send({ embeds: [this.buildUpdateEmbed(status)] });
        this.lastNotifiedVersion = status.latestVersion;
        this.logger.info(`Yeni sürüm bildirildi: ${status.latestVersion}`);
        return status;
    }

    async sendOperationalReport(reason = 'manuel') {
        if (!this.config.project.reportingEnabled) {
            return { sent: false, reason: 'Raporlama devre dışı.' };
        }
        const channel = await this.getReportChannel();
        if (!channel) return { sent: false, reason: 'Rapor kanalı bulunamadı veya erişilemiyor.' };

        const embed = await this.buildSystemStatusEmbed({ includeUpdate: true });
        try {
            const stats = await this.getProjectStats();
            embed.addFields(
                { name: 'GitHub Yıldız', value: String(stats.stars), inline: true },
                { name: 'GitHub Fork', value: String(stats.forks), inline: true },
                { name: 'Release Asset İndirme', value: String(stats.totalDownloads), inline: true }
            );
        } catch (error) {
            this.logger.warn(`GitHub proje istatistikleri rapora eklenemedi: ${error.message}`);
        }
        embed.setFooter({ text: `Rapor türü: ${reason}` });
        await channel.send({ embeds: [embed] });
        return { sent: true, channelId: channel.id };
    }

    start() {
        if (this.started) return;
        this.started = true;

        if (this.config.project.updateCheckEnabled) {
            const intervalMs = this.config.project.updateCheckIntervalHours * 3600000;
            this.interval = setInterval(() => {
                this.notifyUpdateIfNeeded().catch(error => this.logger.warn(`Güncelleme kontrolü başarısız: ${error.message}`));
            }, intervalMs);
            this.interval.unref?.();
            setTimeout(() => {
                this.notifyUpdateIfNeeded().catch(error => this.logger.warn(`Başlangıç güncelleme kontrolü başarısız: ${error.message}`));
            }, 3000).unref?.();
        }

        if (this.config.project.reportingEnabled && this.config.project.dailyReportEnabled) {
            const hour = this.config.project.dailyReportHour;
            this.dailyTask = cron.schedule(`0 0 ${hour} * * *`, () => {
                this.sendOperationalReport('günlük').catch(error => this.logger.warn(`Günlük rapor gönderilemedi: ${error.message}`));
            }, { timezone: this.config.schedule.timezone });
        }

        if (this.config.project.reportingEnabled && this.config.project.startupReportEnabled) {
            setTimeout(() => {
                this.sendOperationalReport('başlangıç').catch(error => this.logger.warn(`Başlangıç raporu gönderilemedi: ${error.message}`));
            }, 5000).unref?.();
        }

        this.logger.info('Proje izleme ve güncelleme servisi başlatıldı.');
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        if (this.dailyTask) {
            try {
                this.dailyTask.stop();
                this.dailyTask.destroy?.();
            } catch (error) {
                this.logger.warn(`Günlük rapor görevi durdurulamadı: ${error.message}`);
            }
        }
        this.dailyTask = null;
        this.started = false;
    }
}

module.exports = ProjectMonitor;
