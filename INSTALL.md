# Kurulum Rehberi

Bu sürüm **self-hosted ve tek sunucu** içindir. Her kurulum kendi Discord uygulamasını ve bot tokenını kullanır.

## 1. Gereksinimler

- Node.js `20.17.0` veya daha yeni
- npm
- Discord sunucusunda uygulama ekleme yetkisi
- Git

Sürüm kontrolü:

```bash
node --version
npm --version
git --version
```

## 2. Discord uygulamasını oluştur

Discord Developer Portal'da yeni bir Application oluşturun ve **Bot** bölümünden bot kullanıcısını oluşturun.

### Privileged Gateway Intents

Bot sayfasında:

- Presence Intent: kapalı
- Server Members Intent: **açık**
- Message Content Intent: kapalı

Bu proje `Guilds` ve `GuildMembers` intent'lerini kullanır.

## 3. Botu sunucuya ekle

Guild Install için OAuth2 kapsamları:

- `bot`
- `applications.commands`

Önerilen bot izinleri:

- View Channels
- Send Messages
- Embed Links
- Attach Files

`Administrator`, `Ban Members`, `Kick Members`, `Manage Messages` veya `Manage Roles` gerekmez.

Özel kanallarda Discord kanal/rol overwrite ayarlarının bot rolüne ayrıca izin verdiğini kontrol edin.

## 4. Kaynak kodu indir

```bash
git clone https://github.com/osmanilcektu/discord-mod-takvimi.git
cd discord-mod-takvimi
npm ci
```

Windows PowerShell:

```powershell
Copy-Item .\config.example.env .\.env
notepad .\.env
```

Linux/macOS:

```bash
cp config.example.env .env
nano .env
```

## 5. `.env` yapılandırması

Zorunlu temel alanlar:

```env
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id

ADMIN_MOD_CHANNEL_ID=your_admin_channel_id
LOG_CHANNEL_ID=your_log_channel_id
SCHEDULE_CHANNEL_ID=your_schedule_channel_id
MOD_SCHEDULE_CHANNEL_ID=your_schedule_channel_id

MOD_ROLES=MOD,SR MOD,HEAD MOD
```

Discord ID kopyalamak için Discord'da Developer Mode'u açın ve sunucu/kanal üzerinde **Copy ID** kullanın.

Gerçek bot tokenını hiçbir issue, commit, ekran görüntüsü veya mesajda paylaşmayın.

## 6. İlk doğrulama

```bash
npm run setup -- --test
npm run verify
npm audit
npm run doctor
```

`npm run doctor`, gerçek Discord bağlantısını, `GUILD_ID`, moderatör rollerini ve yapılandırılmış kanallardaki bot yetkilerini kontrol eder.

## 7. Botu başlat

```bash
npm start
```

Başarılı başlangıç örneği:

```text
✅ bot-adı olarak giriş yapıldı.
🌐 1 sunucuda aktif.
3 slash komut sunucuya kaydedildi.
N moderatör tarandı ve veritabanı güncellendi.
Bot başlangıç işlemleri tamamlandı.
```

## 8. Discord içinde ilk test

Sırayla:

```text
/yardim
/mod
/admin permissions
/admin modlari-guncelle
/admin mod-listesi
/admin sistem-durumu
```

`/admin permissions` kanal sorunu gösteriyorsa Discord kanal izinlerinde bot rolüne eksik yetkiyi verin.

## 9. Otomatik sistemi aç

Kurulum ve manuel testler temiz olduktan sonra:

```env
AUTO_SCHEDULE_ENABLED=true
REPORTING_ENABLED=true
STARTUP_REPORT_ENABLED=true
DAILY_REPORT_ENABLED=true
```

Botu yeniden başlatın.

## 10. 7/24 çalıştırma

### PM2

```bash
npm install -g pm2
pm2 start src/index.js --name modtakvim
pm2 save
pm2 startup
```

### Docker

Projede verilen `Dockerfile` ve `docker-compose.yml` kullanılabilir:

```bash
docker compose up -d --build
docker compose logs -f
```

`.env` ve `data/` host üzerinde kalır.

## Güncelleme

Yeni release bildirimi geldiğinde:

```bash
git pull
npm ci
npm run verify
npm audit
npm run doctor
```

Kontroller başarılıysa botu yeniden başlatın.

Otomatik sürüm bildirimi uzaktan kod çalıştırmaz; güncellemeyi yönetici bilinçli olarak uygular.
