# Discord Moderatör Takvim Botu

Discord sunucularındaki moderasyon ekiplerinin vardiya ve çalışma takvimlerini otomatik olarak yönetmek için geliştirilmiş açık kaynaklı Discord botu.

Otomatik vardiya oluşturma, moderatör anketleri, çalışma yükü dengeleme, kalıcı vardiyalar, devamsızlık takibi ve yönetim komutlarını tek sistem altında toplar.

> Proje Node.js, JavaScript ve SQLite kullanılarak geliştirilmiştir.

---

## Özellikler

### Otomatik Takvim Sistemi

- Günlük takvim kontrolü
- Otomatik moderatör anketleri
- Yapılandırılabilir anket süresi
- Moderatör uygunluk kontrolü
- Otomatik vardiya oluşturma
- Eksik moderatörler için yerine atama
- Moderatör çalışma yükünün dengelenmesi
- Son çalışma durumlarına göre rotasyon

### Moderatör Yönetimi

- Moderatör ekleme
- Moderatör listesini güncelleme
- Kalıcı vardiya tanımlama
- Kullanıcı bazlı zaman izinleri
- Manuel vardiya değiştirme
- Devamsızlık takibi
- Moderatör iş yükü analizi

### Otomatik Bildirimler

- Discord kanal bildirimleri
- Moderatörlere DM bildirimleri
- Yönetici bildirimleri
- Sistem ve hata logları
- Takvim yayınlama sistemi

### Ceza Sistemi

Varsayılan yapılandırmada:

1. İlk ihlal → 2 gün moderatörlük kısıtlaması
2. İkinci ihlal → 1 saat yazma kısıtlaması
3. Üçüncü ve sonraki ihlaller → 1 gün moderatörlük kısıtlaması

Bu değerler `.env` üzerinden yapılandırılabilir.

---

## Admin Komutları

Yönetim komutları `/admin` altında toplanmıştır.

| Komut | Açıklama |
| --- | --- |
| `/admin takvim-olustur` | Günlük takvim oluşturur |
| `/admin kullanici-izin` | Kullanıcıya özel izin veya kısıtlama tanımlar |
| `/admin kalici-saat` | Moderatöre kalıcı vardiya atar |
| `/admin saat-degistir` | Kullanıcının vardiyasını değiştirir |
| `/admin mod-ekle` | Sisteme moderatör ekler |
| `/admin modlari-guncelle` | Moderatör listesini günceller |
| `/admin takvim-gonder` | Moderatörlere takvim anketi gönderir |
| `/admin takvim-sil` | Belirtilen tarihin takvimini siler |
| `/admin cezali-listesi` | Kısıtlanan kullanıcıları listeler |
| `/admin ban-kaldir` | Kullanıcının kısıtlamasını kaldırır |
| `/admin stats` | Bot istatistiklerini görüntüler |
| `/admin permissions` | Bot izinlerini kontrol eder |

---

## Sistem Nasıl Çalışır?

Varsayılan otomatik süreç:

1. Bot belirlenen saatte günlük takvim durumunu kontrol eder.
2. Takvim oluşturulmamışsa moderatörlere otomatik anket gönderilir.
3. Moderatörlerin yanıt vermesi için belirlenen süre beklenir.
4. Yanıtlar ve moderatör uygunlukları değerlendirilir.
5. Uygun moderatörler vardiyalara atanır.
6. Yanıt vermeyen kullanıcılar yapılandırılmış kurallara göre işlenir.
7. Gerektiğinde alternatif moderatör atanır.
8. Oluşturulan takvim Discord kanalında yayınlanır.
9. İlgili kullanıcılara DM bildirimi gönderilir.

---

## Gereksinimler

- Node.js 16 veya üzeri
- npm
- Discord Bot Token
- Discord sunucusu
- SQLite
- Linux / Ubuntu önerilir

> Proje ağırlıklı olarak Ubuntu/Linux ortamında kullanılmıştır. Diğer işletim sistemlerinde davranış farklılıkları olabilir.

---

## Kurulum

### 1. Repository'yi klonlayın

```bash
git clone https://github.com/osmanilcektu/discord-mod-takvimi.git
cd discord-mod-takvimi
```

### 2. Bağımlılıkları yükleyin

```bash
npm install
```

### 3. Ortam dosyasını oluşturun

```bash
cp config.example.env .env
```

Ardından `.env` dosyasını düzenleyin:

```bash
nano .env
```

---

## Yapılandırma

Örnek `.env`:

```env
# Discord Bot Token
DISCORD_TOKEN=your_bot_token_here

# Discord Server ID
GUILD_ID=your_server_id_here

# Kanallar
ADMIN_MOD_CHANNEL_ID=your_admin_channel_id
LOG_CHANNEL_ID=your_log_channel_id
SCHEDULE_CHANNEL_ID=your_schedule_channel_id
MOD_SCHEDULE_CHANNEL_ID=your_mod_schedule_channel_id

# Moderatör Rolleri
MOD_ROLES=MOD,SR MOD,HEAD MOD

# Otomatik Sistem
AUTO_SCHEDULE_ENABLED=true
DAILY_SCHEDULE_HOUR=8
SURVEY_TIMEOUT_HOURS=5

# Ceza Süreleri
FIRST_VIOLATION_DAYS=2
SECOND_VIOLATION_DAYS=1
THIRD_VIOLATION_DAYS=1
WRITE_TIMEOUT_MINUTES=60
```

### Güvenlik

Gerçek Discord Bot Token'ınızı hiçbir zaman repository'ye göndermeyin.

`.env` dosyası Git tarafından takip edilmemelidir.

Yalnızca örnek yapılandırma dosyası olan:

```text
config.example.env
```

repository içerisinde tutulmalıdır.

Bir token yanlışlıkla GitHub'a gönderildiyse yalnızca dosyayı silmek yeterli değildir. İlgili token Discord Developer Portal üzerinden iptal edilmeli ve yenisi oluşturulmalıdır.

---

## Botu Başlatma

Veritabanı kurulumunu çalıştırın:

```bash
npm run setup
```

Botu başlatın:

```bash
npm start
```

Geliştirme modu:

```bash
npm run dev
```

---

## Veritabanı

Proje SQLite kullanır.

Sistemde kullanılan temel tablolar:

| Tablo | Amaç |
| --- | --- |
| `moderators` | Moderatör bilgileri |
| `daily_assignments` | Günlük vardiya atamaları |
| `mod_responses` | Moderatör anket yanıtları |
| `absent_users` | Devamsızlık ve kısıtlama kayıtları |
| `permanent_shifts` | Kalıcı vardiyalar |
| `user_time_permissions` | Kullanıcı zaman izinleri |
| `schedule_status` | Otomatik takvim durumu |

Veritabanı dosyalarının düzenli olarak yedeklenmesi önerilir.

---

## Kanal Yapısı

Bot farklı görevler için ayrı Discord kanalları kullanabilir.

### Admin Kanalı

Yönetim işlemleri ve yönetici bildirimleri.

### Log Kanalı

- Sistem olayları
- Kullanıcı hareketleri
- Devamsızlıklar
- Cezalar
- Hatalar

### Takvim Kanalı

Oluşturulan moderatör vardiyalarının yayınlandığı kanal.

---

## Kalıcı Vardiyalar

Yöneticiler belirli moderatörlere kalıcı vardiya atayabilir.

Bu özellik, belirli saatlerde düzenli çalışan ekip üyelerinin otomatik planlama sırasında aynı zaman diliminde tutulmasını sağlar.

---

## Zaman Kısıtlamaları

Kullanıcı bazında belirli saatlerde:

- Çalışma izni
- Çalışma kısıtlaması
- Kalıcı vardiya

tanımlanabilir.

Bu bilgiler otomatik takvim oluşturulurken dikkate alınır.

---

## Sorun Giderme

### Bot çalışmıyorsa

Logları kontrol edin:

```bash
tail -f logs/bot.log
```

Veritabanını kontrol edin:

```bash
sqlite3 data/bot.db ".tables"
```

Bağımlılıkları yeniden yüklemek için:

```bash
npm install
```

### Anket gönderilmiyorsa

Şunları kontrol edin:

- Discord Bot Token
- Botun sunucu izinleri
- Kanal ID'leri
- Moderatör rollerinin isimleri
- DM izinleri
- Log çıktıları

### Otomatik sistem çalışmıyorsa

`.env` içerisinde:

```env
AUTO_SCHEDULE_ENABLED=true
```

olduğunu doğrulayın.

Ayrıca:

- Sistem saatini
- Sunucu saat dilimini
- Bot prosesini
- Log dosyalarını

kontrol edin.

---

## Proje Yapısı

Repository'nin temel yapısı:

```text
discord-mod-takvimi/
├── src/
├── .gitignore
├── config.example.env
├── package.json
├── README.md
└── LICENSE
```

`src/` dizini botun uygulama kaynak kodunu içerir.

---

## Güvenlik

Repository üzerinde:

- GitHub Secret Scanning
- Push Protection
- Dependabot
- CodeQL
- GitHub Security Advisories

gibi GitHub güvenlik özelliklerinin kullanılması önerilir.

Bir güvenlik açığı tespit ederseniz mümkünse hassas ayrıntıları herkese açık bir Issue içerisinde paylaşmayın.

Repository'nin **Security** bölümündeki özel güvenlik bildirim mekanizmasını kullanın.

---

## Katkıda Bulunma

Katkılar açıktır.

Katkıda bulunmak için:

1. Repository'yi fork edin.
2. Yeni bir branch oluşturun.
3. Değişikliğinizi yapın.
4. Değişikliğinizi test edin.
5. Açıklayıcı bir commit oluşturun.
6. Pull Request gönderin.

Örnek:

```bash
git checkout -b fix/scheduler-rotation
```

Commit:

```bash
git commit -m "Fix moderator rotation logic"
```

Push:

```bash
git push origin fix/scheduler-rotation
```

Ardından GitHub üzerinden Pull Request oluşturabilirsiniz.

Katkılar özellikle şu alanlarda değerlidir:

- Hata düzeltmeleri
- Takvim algoritması geliştirmeleri
- Discord.js uyumluluk güncellemeleri
- Veritabanı iyileştirmeleri
- Testler
- Dokümantasyon
- Güvenlik geliştirmeleri
- Yeni özellikler

---

## Issue Bildirimi

Hata veya özellik talebi için:

[GitHub Issues](https://github.com/osmanilcektu/discord-mod-takvimi/issues)

Hata bildirirken mümkünse şunları ekleyin:

- Node.js sürümü
- İşletim sistemi
- Hatanın açıklaması
- Hatanın nasıl tekrarlandığı
- İlgili log çıktısı
- Beklenen davranış
- Gerçekleşen davranış

> Token, kullanıcı bilgisi veya başka gizli verileri Issue içine eklemeyin.

---

## Sürüm

Mevcut proje sürümü:

```text
v2.0
```

v2.0 ile öne çıkan değişiklikler:

- Birleştirilmiş `/admin` komut sistemi
- Otomatik takvim oluşturma
- Moderatör anket sistemi
- Otomatik ceza sistemi
- Devamsızlık takibi
- Ayrı log ve takvim kanalları
- DM bildirim sistemi
- Kalıcı vardiyalar
- Kullanıcı zaman izinleri
- Otomatik yerine atama
- Moderatör çalışma yükü dengeleme

---

## Roadmap

Planlanan geliştirmeler:

- Test kapsamının artırılması
- CI kontrollerinin geliştirilmesi
- Yeni Discord.js sürümleriyle uyumluluk
- Takvim algoritmasının geliştirilmesi
- Daha ayrıntılı hata yönetimi
- Yapılandırma doğrulamalarının geliştirilmesi
- Dokümantasyonun genişletilmesi

---

## Lisans

Bu proje [MIT License](LICENSE) altında açık kaynak olarak yayınlanmaktadır.

```text
Copyright (c) 2026 Osman İlçektuğ
```

MIT lisansı kapsamında projeyi kullanabilir, değiştirebilir ve dağıtabilirsiniz. Lisans ve telif hakkı bildiriminin korunması gerekir.

---

## Proje Sahibi

**Osman İlçektuğ**

GitHub:  
https://github.com/osmanilcektu

Website:  
https://osmanilcektu.com

---

## Destek

Projeyi faydalı bulduysanız GitHub üzerinden yıldız verebilirsiniz.

Hata bildirimleri, öneriler ve Pull Request'ler projenin geliştirilmesine katkı sağlar.
