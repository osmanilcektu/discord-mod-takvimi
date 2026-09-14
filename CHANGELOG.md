# Changelog

Bu projedeki önemli değişiklikler burada tutulur.

## [2.2.1] - 2026-09-14

- Etkin kanal izinleri esas alınarak yetki denetimi düzeltildi; aynı kanalın birden çok amaçla kullanılması tek kez kontrol edilir.
- Üretim bağımlılıkları ve nodemon sürümü release tekrarlanabilirliği için sabitlendi; CI/Docker `npm ci` kullanır.

### Fixed

- Discord.js `ephemeral` deprecation uyarıları `MessageFlags.Ephemeral` ile giderildi.
- `/yardim` komutu interaction süresi dolmadan hemen `deferReply` yapacak şekilde güncellendi.
- `Unknown interaction` (`10062`) ve already-acknowledged (`40060`) durumları kritik bot hatası yerine kontrollü olarak ele alınıyor.
- `/admin takvim-yayinla` için henüz yanıt yoksa beklenen durum artık hata logu üretmiyor.
- Haftalık anket hiçbir moderatöre teslim edilemezse anlaşılır yönetici mesajı dönüyor.
- Yetki kontrolü aynı fiziksel kanal birden fazla amaçla kullanıldığında tekrar eden kanal hatalarını birleştiriyor.
- Takvim kanalı için CSV dışa aktarımında gerekli `Attach Files` izni ayrıca doğrulanıyor.

### Changed

- `discord.js` hedefi `^14.27.0`, `dotenv` hedefi `^16.6.1`.
- Node.js minimum sürümü `20.17.0`.
- `clientReady` event adı `Events.ClientReady` sabiti ile kullanılıyor.
- GitHub Actions doğrulaması Node.js 20, 22 ve 24 üzerinde çalışıyor.
- `npm run verify` ve `npm run release:check` eklendi.
- `PRIVACY.md` ve `TERMS.md` eklendi.
- Yeni kurulumlarda otomatik planlama ve operasyon raporları güvenli varsayılan olarak kapalı başlar.

### Release automation

- `v*` etiketi push edildiğinde CI, test ve güvenlik denetiminden sonra GitHub Release ve indirilebilir ZIP asset'i otomatik oluşturulur.
- Bu asset'in GitHub indirme sayısı botun `/admin proje-istatistik` raporuna dahil edilir.

## [2.2.0] - 2026-09-14

### Added
- GitHub Releases üzerinden otomatik yeni sürüm kontrolü ve özel kanal bildirimi.
- Başlangıç, günlük ve manuel operasyon raporları.
- `/admin sistem-durumu`, `/admin guncelleme-kontrol`, `/admin proje-istatistik`, `/admin rapor-gonder`, `/admin mod-listesi`.
- GitHub release asset indirme istatistikleri.
- Proje izleme birim testleri.
- `npm run doctor` ile canlı Discord sunucu/kanal/rol/yetki doğrulaması.
- `npm run update:check` ile terminalden GitHub Release kontrolü.

### Changed
- Discord `ready` event kullanımı `clientReady` olarak güncellendi.
- `/admin mod-ekle` rol seçenekleri ve vardiya seçenekleri artık `.env` yapılandırmasından dinamik üretilir.
- node-cron 4.6.0 ve sqlite3 6.0.1 hedeflendi.
- Yerel `.env` dosyasını güvenli biçimde kabul eden statik kontrol güncellendi.

### Security
- Otomatik güncelleme yalnızca bildirim/istek modelindedir; uzaktan kod çalıştırma veya gizli telemetri eklenmedi.

## [2.1.0] - 2026-09-14

### Fixed

- Çift scheduler/cron oluşturma kaldırıldı.
- Tanımlanmamış `client.autoScheduler` çağrısı kaldırıldı.
- Günlük atama şeması ile eski `day_mod_*` / `night_mod_*` alanları arasındaki uyumsuzluk giderildi.
- `absent_users.updated_at` migration'ı eski SQLite veritabanlarıyla uyumlu hale getirildi.
- Var olmayan `saveSlotAssignment` / DB API uyumsuzlukları giderildi.
- Günlük anket select/button/modal interaction routing tamamlandı.
- Geçici anket seçimi manager instance yerine client seviyesinde saklandı.
- Availability değerinin ikinci kez JSON parse edilmesi nedeniyle oluşabilecek hata kaldırıldı.
- Aynı moderatörün aynı gün birden fazla vardiyaya atanması engellendi.
- Kullanıcının seçmediği vardiyaya fallback atama yapılması engellendi.
- Mazeret/anket yanıtı kalıcı vardiya seçiminde dikkate alındı.
- Anket son zamanı veritabanına taşındı; restart sonrası bekleyen anketler kurtarılıyor.
- UTC tarih üretiminden kaynaklanabilecek günlük tarih kaymaları giderildi.
- Ceza alanı isimleri ile SQLite şeması arasındaki uyumsuzluklar giderildi.
- Aktif moderatör listesi boş olduğunda eski moderatörlerin aktif kalması sorunu giderildi.
- Günlük atamalar transaction ile atomik kaydediliyor.
- Takvim kanalına gönderim hatası veritabanındaki geçerli planı bozmuyor.
- Weekly/daily anket deadline kontrolü eklendi.
- `SIGTERM` graceful shutdown desteği eklendi ve fatal exit kodları düzeltildi.
- Bot kısa süre kapalı kaldığında kaçırılan günlük anket başlangıcını güvenli süre penceresinde telafi eden catch-up kontrolü eklendi.
- Cezalı moderatörlere yeni anket/tekrarlı ceza uygulanması ve bir ceza biterken başka aktif cezanın yanlışlıkla kaldırılması engellendi.
- Hiçbir DM teslim edilemezse anket `failed` durumuna alınarak sahte bekleyen görev bırakılması engellendi.

### Changed

- Node.js minimum sürümü 20 oldu.
- Bot yalnızca `Guilds` ve `GuildMembers` intent'lerini kullanıyor.
- Ceza mekanizması Discord banı yerine planlama kısıtlaması olarak netleştirildi.
- İzin kontrolü gereksiz `BanMembers` / `ManageMessages` yetkilerini istemiyor.
- Yardım komutu ve README güncel komut/scheduler yapısıyla yenilendi.
- Haftalık müsaitlik özeti için `/admin takvim-yayinla` eklendi.
- CSV export bellekten üretiliyor ve spreadsheet formula injection'a karşı kaçış uyguluyor.

### Added

- `scripts/check.js` statik proje denetimi.
- Node built-in test runner ile tarih/vardiya testleri.
- GitHub Actions CI.
- Dependabot yapılandırması.
- `CONTRIBUTING.md` ve güncel `SECURITY.md`.

## [2.0.0]

- Otomatik günlük vardiya sistemi.
- Müsaitlik anketleri.
- Kalıcı vardiyalar.
- Kullanıcı zaman izinleri/kısıtlamaları.
- İş yükü tabanlı rotasyon.
- SQLite tabanlı planlama verisi.
