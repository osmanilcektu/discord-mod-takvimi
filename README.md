# Discord Moderatör Takvim Botu

Discord moderasyon ekipleri için otomatik vardiya, müsaitlik anketi, iş yükü dengeleme ve planlama yönetimi botu.

**Sürüm:** `v2.2.1`
**Runtime:** Node.js 20.17+
**Veritabanı:** SQLite
**Lisans:** MIT

**Dağıtım modeli:** Self-hosted, tek Discord sunucusu / tek bot süreci

> Bu sürüm merkezi, herkese açık bir SaaS bot değildir. Her kullanıcı kendi Discord uygulamasını/tokenını oluşturur ve botu kendi sunucusunda çalıştırır. Bir bot süreci tek `GUILD_ID` için yapılandırılır.


## Öne Çıkan Özellikler

- 24 saati kapsayan 5 vardiyalı günlük planlama
- Ertesi gün için otomatik DM müsaitlik anketi
- Yeniden başlatma sonrasında bekleyen anketleri veritabanından kurtarma
- Kullanıcının seçmediği vardiyaya otomatik atama yapmama
- Aynı moderatörü aynı gün birden fazla vardiyaya atamama
- Kalıcı vardiya ve saat bazlı izin/kısıtlama
- Son 7 güne göre iş yükü dengeleme
- Yanıt vermeyen, anketi başarıyla teslim edilmiş kullanıcılar için geçici **planlama kısıtlaması**
- Günlük takvimin Discord kanalına yayınlanması ve DM bildirimi
- Manuel haftalık müsaitlik anketi ve özet yayını
- SQLite WAL, şema geçişleri ve atomik günlük atama kaydı
- SQLite sürücüsü şu an `sqlite3@6.0.1`; upstream paket bakım durumuna karşı gelecekte alternatif sürücü geçişi izlenir
- Graceful shutdown (`SIGINT` / `SIGTERM`)
- GitHub Actions CI, statik kontroller ve birim testleri
- GitHub Releases üzerinden otomatik yeni sürüm kontrolü ve yönetici bildirimi
- Özel operasyon kanalına başlangıç/günlük/manuel sistem raporları
- GitHub yıldız, fork, release asset indirme ve proje istatistikleri

## Vardiyalar

Varsayılan yapı:

| Slot | Saat |
| --- | --- |
| `slot1` | 00:00-05:00 |
| `slot2` | 05:00-10:00 |
| `slot3` | 10:00-15:00 |
| `slot4` | 15:00-20:00 |
| `slot5` | 20:00-24:00 |

`TIME_SLOTS` tam 5 adet, ardışık, çakışmasız vardiya içermeli; 00:00'da başlayıp 24:00'da bitmelidir.

## Gereksinimler

- Node.js `>=20.17.0`
- npm
- Discord bot uygulaması ve token
- Discord sunucusu
- Bot için **Server Members Intent** etkinleştirilmiş olmalı

Bot yalnızca `Guilds` ve `GuildMembers` gateway intent'lerini kullanır; Message Content intent gerekmez.

## Kurulum

```bash
git clone https://github.com/osmanilcektu/discord-mod-takvimi.git
cd discord-mod-takvimi
npm ci
cp config.example.env .env
```

İstersen interaktif kurulum:

```bash
npm run setup
```

Repo `package-lock.json` dosyasını içerir; normal kurulumda tekrarlanabilir bağımlılık kurulumu için `npm ci` kullanılır.

Ardından kontrolleri çalıştır:

```bash
npm run verify
npm audit
npm run doctor
```

Botu başlat:

```bash
npm start
```

Geliştirme modu:

```bash
npm run dev
```

Detaylı kurulum: [`INSTALL.md`](INSTALL.md)

Sorun giderme: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)

## Discord Developer Portal

Bot ayarlarında **Server Members Intent** açık olmalıdır.

Guild Install OAuth2 kapsamları:

- `bot`
- `applications.commands`

Botun kullanacağı kanallarda en az şu bot izinleri bulunmalıdır:

- View Channel
- Send Messages
- Embed Links
- Attach Files

`Use Application Commands`, bot rolü için bir çalışma gereksinimi olarak kullanılmaz; slash komutların sunucuya kurulması `applications.commands` OAuth2 scope'u ile yapılır. Bot planlama cezalarını kendi veritabanında uygular; `Administrator`, `Ban Members`, `Kick Members`, `Manage Roles` veya `Manage Messages` izni gerekmez.

## Yapılandırma

Örnek `.env` dosyası için [`config.example.env`](config.example.env) kullanın.

Temel değerler:

```env
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=123456789012345678

ADMIN_MOD_CHANNEL_ID=123456789012345678
LOG_CHANNEL_ID=123456789012345678
SCHEDULE_CHANNEL_ID=123456789012345678
MOD_SCHEDULE_CHANNEL_ID=123456789012345678

MOD_ROLES=MOD,SR MOD,HEAD MOD

AUTO_SCHEDULE_ENABLED=false
DAILY_SCHEDULE_HOUR=8
SURVEY_TIMEOUT_HOURS=5
TIMEZONE=Europe/Istanbul

RESPONSE_TIMEOUT_HOURS=24

FIRST_VIOLATION_DAYS=2
SECOND_VIOLATION_HOURS=1
THIRD_VIOLATION_DAYS=1

TIME_SLOTS=["00:00-05:00","05:00-10:00","10:00-15:00","15:00-20:00","20:00-24:00"]

DATABASE_PATH=./data/bot.db
LOG_LEVEL=info

GITHUB_REPOSITORY=osmanilcektu/discord-mod-takvimi
UPDATE_CHECK_ENABLED=true
UPDATE_CHECK_INTERVAL_HOURS=6
UPDATE_CHANNEL_ID=123456789012345678

REPORTING_ENABLED=false
STARTUP_REPORT_ENABLED=false
DAILY_REPORT_ENABLED=false
DAILY_REPORT_HOUR=9
REPORT_CHANNEL_ID=123456789012345678
```

### Güvenli ilk çalıştırma

Yeni kurulumlarda otomatik günlük planlama ve operasyon raporları varsayılan olarak kapalıdır. Önce `npm run doctor` ve manuel slash komut testlerini tamamlayın; ardından ihtiyacınıza göre `AUTO_SCHEDULE_ENABLED=true` ve `REPORTING_ENABLED=true` yapın.

### Kanal fallback davranışı

`LOG_CHANNEL_ID`, `SCHEDULE_CHANNEL_ID` veya `MOD_SCHEDULE_CHANNEL_ID` verilmezse yapılandırma uygun olduğunda admin kanalına geri düşer. Geçersiz bir Discord ID verilirse bot başlangıçta yapılandırma hatası verir.

## Otomatik Günlük Akış

1. `DAILY_SCHEDULE_HOUR` saatinde **ertesi gün** için anket başlatılır.
2. Anketin son zamanı SQLite'a yazılır.
3. DM'in başarıyla teslim edildiği kullanıcılar kayıt altına alınır.
4. Bot yeniden başlasa bile süresi dolan anketler 5 dakikalık kurtarma göreviyle tamamlanır.
5. Kullanıcıların seçtiği vardiyalar değerlendirilir.
6. Mazeret bildiren veya ilgili vardiyayı seçmeyen kullanıcı o vardiyaya atanmaz.
7. Kalıcı vardiyalar, saat izinleri/kısıtlamaları ve iş yükü hesaba katılır.
8. Atamalar tek transaction içinde kaydedilir.
9. Günlük takvim yayınlanır ve atanan moderatörlere DM gönderilir.

Yeterli uygun moderatör yoksa sistem yanlış kişiyi zorla atamak yerine ilgili slotu boş bırakır.

## Planlama Cezası

Bu sistem Discord banı veya yazma yasağı uygulamaz. Ceza yalnızca otomatik vardiya planlamasına katılımı geçici olarak engeller.

Varsayılan süreler:

1. ihlal: `FIRST_VIOLATION_DAYS=2` gün
2. ihlal: `SECOND_VIOLATION_HOURS=1` saat
3. ve sonrası: `THIRD_VIOLATION_DAYS=1` gün

Yalnızca günlük anket DM'i **başarıyla teslim edilmiş** fakat zamanında yanıt verilmemiş kullanıcılar otomatik olarak işlenir.

## Slash Komutları

### `/mod`

Şu anda aktif vardiyayı ve mümkünse sıradaki atamayı gösterir.

### `/yardim`

Komutları, vardiyaları ve scheduler durumunu gösterir.

### `/admin`

Yalnızca Discord `Administrator` yetkisine sahip kullanıcılar içindir.

| Alt komut | Açıklama |
| --- | --- |
| `takvim-olustur` | Günlük müsaitlik anketini başlatır |
| `kullanici-izin` | Saat bazlı izin/kısıtlama tanımlar |
| `kalici-saat` | Kalıcı vardiya atar |
| `saat-degistir` | Var olan günlük vardiyayı değiştirir |
| `mod-ekle` | Moderatörü veritabanına ekler |
| `modlari-guncelle` | Discord rollerinden moderatörleri yeniden tarar |
| `takvim-gonder` | Haftalık müsaitlik anketi gönderir |
| `takvim-yayinla` | Haftalık müsaitlik özetini yayınlar |
| `takvim-sil` | Belirli günün vardiyalarını siler |
| `cezali-listesi` | Aktif planlama kısıtlamalarını listeler |
| `ban-kaldir` | Aktif planlama kısıtlamasını kaldırır |
| `stats` | Bot/scheduler istatistiklerini gösterir |
| `permissions` | Bot ve kanal izinlerini denetler |
| `workload` | Son 7 günlük iş yükünü gösterir |
| `sistem-durumu` | Ayrıntılı sağlık, kaynak ve güncelleme durumunu gösterir |
| `guncelleme-kontrol` | GitHub Releases üzerinden yeni sürüm kontrolü yapar |
| `proje-istatistik` | Yıldız, fork, release ve release asset indirme sayılarını gösterir |
| `rapor-gonder` | Özel operasyon kanalına anlık sistem raporu gönderir |
| `mod-listesi` | Aktif moderatörleri ve rollerini listeler |

## Veritabanı

SQLite tabloları arasında şunlar bulunur:

- `moderators`
- `mod_responses`
- `survey_periods`
- `survey_deliveries`
- `daily_assignments`
- `schedule_status`
- `permanent_shifts`
- `user_time_permissions`
- `absent_users`

Eski `daily_assignments` şeması tespit edilirse eski tablo korunarak `daily_assignments_legacy_<timestamp>` adına taşınır ve yeni slot tabanlı tablo oluşturulur.

## Güncelleme ve Release Akışı

Bot, GitHub Releases üzerinden yeni sürümleri kontrol eder. `UPDATE_CHECK_ENABLED=true` olduğunda yeni bir sürüm bulunduğunda yapılandırılmış Discord kanalına bildirim gönderir; **kendiliğinden kod indirme veya çalıştırma yapmaz**.

Bakımcı için release süreci:

```bash
npm install
npm run release:check
npm audit
git add .
git commit -m "Release v2.2.1"
git tag v2.2.1
git push origin main
git push origin v2.2.1
```

`v*` etiketi GitHub'a ulaştığında `.github/workflows/release.yml`:

1. sürüm etiketi ile `package.json` sürümünü eşleştirir;
2. statik kontrol, test ve güvenlik denetimi çalıştırır;
3. repodaki takip edilen dosyalardan temiz bir ZIP üretir;
4. GitHub Release oluşturur;
5. ZIP'i Release Asset olarak ekler.

Release asset indirmeleri `/admin proje-istatistik` çıktısındaki indirme sayısına dahil edilir.

## Güvenlik

- Gerçek `DISCORD_TOKEN` hiçbir zaman commit edilmemelidir.
- `.env`, SQLite veritabanları, loglar ve runtime klasörleri `.gitignore` içindedir.
- Token GitHub'a yanlışlıkla gönderildiyse dosyayı silmek yeterli değildir; Discord Developer Portal'dan tokenı yenileyin.
- Hassas güvenlik açıklarını public issue yerine GitHub **Private vulnerability reporting** üzerinden gönderin.

Detaylar: [`SECURITY.md`](SECURITY.md) • [`PRIVACY.md`](PRIVACY.md) • [`TERMS.md`](TERMS.md)

## Kalite Kontrolleri

Statik doğrulama:

```bash
npm run check
```

Bu kontrol:

- tüm JavaScript dosyalarında sözdizimi kontrolü yapar;
- çağrılan database metodlarının gerçekten tanımlı olduğunu kontrol eder;
- yaygın Discord token biçimlerini tarar;
- runtime `.env` / SQLite dosyalarının repoda bulunmadığını kontrol eder;
- temel proje dosyalarını doğrular.

Birim testleri:

```bash
npm test
```

Tek komutla yerel doğrulama:

```bash
npm run verify
```

Canlı Discord yapılandırma/yetki testi:

```bash
npm run doctor
```

GitHub Actions, her `main` push'unda ve pull request'te Node.js 20, 22 ve 24 üzerinde kurulum + statik kontrol + test + güvenlik denetimini çalıştırır.

## Proje Yapısı

```text
discord-mod-takvimi/
├── .github/
│   ├── workflows/node-ci.yml
│   └── dependabot.yml
├── scripts/
│   └── check.js
├── src/
│   ├── commands/
│   ├── database/
│   ├── events/
│   ├── utils/
│   ├── index.js
│   └── setup.js
├── test/
├── config.example.env
├── CONTRIBUTING.md
├── CHANGELOG.md
├── SECURITY.md
├── LICENSE
├── package.json
└── README.md
```

## Güncelleme ve Operasyon Raporları

Bot, `GITHUB_REPOSITORY` için GitHub Releases API'sini kullanarak yeni sürümü kontrol eder. Yeni sürüm bulunduğunda `UPDATE_CHANNEL_ID` kanalına bildirim gönderir. **Kod kendiliğinden indirilmez veya çalıştırılmaz**; güncelleme yönetici onayı gerektirir. Bu tercih, hatalı/ele geçirilmiş bir release'in otomatik olarak üretim botuna kurulmasını engeller.

`REPORT_CHANNEL_ID` için ayrı, yalnızca yönetici ekibinin görebildiği özel bir Discord kanalı önerilir. Ayrı bir gizli Discord sunucusu zorunlu değildir. Üretim raporları için aynı sunucuda yalnızca yönetici ekibinin görebildiği `🔒・modtakvim-sistem` benzeri özel bir kanal yeterlidir. Ayrı bir özel **test sunucusu** ise release yayınlamadan önce deneme yapmak için faydalıdır. Başlangıç raporu, günlük rapor ve `/admin rapor-gonder` aynı özel kanalı kullanabilir.

`/admin proje-istatistik` GitHub Release **asset** dosyalarının `download_count` değerlerini toplar. GitHub'ın otomatik source-code ZIP/TAR bağlantıları release asset olmadığı için bu sayaca dahil değildir; indirme takibi istiyorsanız her release'e sürüm ZIP dosyasını asset olarak yükleyin.

Bot gizli telemetri göndermez. Birden fazla kurulumdan merkezi aktif kurulum sayısı toplamak istenirse bu daha sonra açıkça opt-in bir telemetri servisi olarak ayrıca tasarlanmalıdır.

## Katkıda Bulunma

Katkılar açıktır. Ayrıntılar için [`CONTRIBUTING.md`](CONTRIBUTING.md) dosyasına bakın.

## Lisans

Bu proje [MIT License](LICENSE) altında yayınlanmaktadır.

Copyright (c) 2026 Osman İlçektuğ

## Proje Sahibi

**Osman İlçektuğ**
GitHub: https://github.com/osmanilcektu
Website: https://osmanilcektu.com
