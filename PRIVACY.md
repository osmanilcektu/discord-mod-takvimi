# Privacy

Discord Moderatör Takvim Botu, **self-hosted** bir açık kaynak projesidir. Projenin varsayılan dağıtımı, geliştirici tarafından işletilen merkezi bir kullanıcı verisi servisine veri göndermez.

## İşlenen veriler

Bot, yapılandırılan Discord sunucusunda çalışırken aşağıdaki verileri işleyebilir ve yerel SQLite veritabanında saklayabilir:

- Discord kullanıcı ID'si
- kullanıcı adı ve görünen ad
- yapılandırılmış moderatör rolleri
- müsaitlik / vardiya yanıtları
- mazeret metinleri
- vardiya atamaları
- planlama kısıtlamaları ve ilgili zaman bilgileri
- operasyonel log kayıtları

Bu veriler botun vardiya ve moderatör planlama işlevleri için kullanılır.

## Veriler nereye gider?

- Discord API: Botun normal Discord işlevleri için.
- Yerel SQLite: `DATABASE_PATH` ile belirlenen dosyada.
- GitHub API: `UPDATE_CHECK_ENABLED=true` olduğunda sürüm kontrolü ve manuel proje istatistikleri için yalnızca herkese açık depo bilgileri alınır.
- Yapılandırılmış Discord rapor kanalı: `REPORTING_ENABLED=true` olduğunda sağlık/operasyon raporları aynı Discord kurulumundaki seçilen kanala gönderilir.

Proje, varsayılan olarak geliştiriciye gizli telemetri, Discord kullanıcı verisi veya veritabanı içeriği göndermez.

## Saklama ve silme

Veriler botu barındıran kişinin kontrolündeki SQLite veritabanında ve log dosyalarında bulunur. Saklama, yedekleme ve silme politikası botu çalıştıran sunucu yöneticisinin sorumluluğundadır.

## Gizli bilgiler

`DISCORD_TOKEN`, `.env` ve veritabanı dosyaları hiçbir zaman public repoya yüklenmemelidir. Token yanlışlıkla paylaşılırsa Discord Developer Portal üzerinden hemen sıfırlanmalıdır.

## İletişim

Gizlilik veya güvenlik konuları için GitHub Issues kullanın; hassas güvenlik bulguları için GitHub Private Vulnerability Reporting tercih edilmelidir.
