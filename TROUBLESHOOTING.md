# Sorun Giderme

## `Used disallowed intents`

`Server Members Intent` kapalıdır.

Discord Developer Portal → Bot → Privileged Gateway Intents → **Server Members Intent ON** → Save Changes.

## `Missing Access`

Genellikle yanlış `GUILD_ID`, botun sunucuda olmaması veya yanlış kanal ID'si anlamına gelir.

```bash
npm run doctor
```

ile gerçek sunucu/kanal erişimini doğrulayın.

## `Yapılandırılan Discord sunucusu bulunamadı`

`.env` içindeki `GUILD_ID` botun gerçekten bulunduğu sunucunun ID'si olmalıdır.

## `/admin permissions` kanal sorunu gösteriyor

Bot rolünün ilgili özel kanalda şu izinleri olduğundan emin olun:

- View Channel
- Send Messages
- Embed Links
- Schedule/CSV kanalında Attach Files

Bir kanal birden fazla amaçla kullanılıyorsa v2.2.1+ raporu aynı fiziksel kanalı tek satırda birleştirir.

## `Unknown interaction` / hata kodu `10062`

Discord interaction ilk yanıtı zamanında alınmamış veya interaction artık geçersiz olabilir. v2.2.1, `/yardim` dahil uzun/özel yanıtları erken acknowledge eder ve süresi dolmuş interaction durumlarını kontrollü biçimde ele alır.

Sorun tekrarlanırsa:

- sistem saatini kontrol edin;
- Discord/API bağlantı gecikmesini kontrol edin;
- botun event loop'unu bloklayan üçüncü taraf kod olmadığından emin olun;
- güncel release'i kullanın.

## `ephemeral ... is deprecated`

v2.2.1+ `MessageFlags.Ephemeral` kullanır. Eski sürüm çalışıyorsa güncelleyin.

## `takvim-yayinla` için yanıt bulunamadı

Bu teknik hata değildir. Önce ilgili dönem için `takvim-gonder` çalıştırın ve moderatör yanıtlarının gelmesini bekleyin.

## DM gönderilemiyor

Kullanıcı botun DM'lerini engellemiş veya sunucu DM ayarlarını kapatmış olabilir. Bot teslim edilemeyen DM'i başarısız olarak kaydeder.

## Slash komutları görünmüyor

- Botu `bot` + `applications.commands` scope'larıyla ekleyin.
- `GUILD_ID` doğru olsun.
- Botu yeniden başlatın.
- Başlangıçta `3 slash komut sunucuya kaydedildi.` logunu arayın.

## SQLite kurulumu başarısız

`sqlite3@6.0.1` için Node.js `20.17.0+` kullanın. Desteklenmeyen mimaride yerel C/C++ derleme araçları gerekebilir.

## Hızlı teşhis

```bash
npm run setup -- --test
npm run verify
npm audit
npm run doctor
```
