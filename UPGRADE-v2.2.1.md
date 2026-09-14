# v2.2.1 Yükseltme Notu

Bu sürüm v2.2.0/v2.1.0 üzerine güvenli patch ve yayın hazırlığı güncellemesidir.

## Önemli değişiklikler

- Discord.js ephemeral deprecation uyarıları kaldırıldı.
- `/yardim` interaction timeout davranışı düzeltildi.
- `Unknown interaction (10062)` kontrollü ele alınıyor.
- `/admin takvim-yayinla` için veri yok durumu artık teknik hata olarak loglanmıyor.
- Yetki kontrolü aynı kanalı tekrar tekrar hata olarak göstermiyor.
- GitHub release otomasyonu, privacy/terms belgeleri ve Docker desteği eklendi.
- Node.js minimum sürümü `20.17.0`.
- `discord.js` sürümü `14.27.0` olarak sabitlendi.

## Yükseltme

Mevcut `.env` ve `data/` klasörünüzü koruyun.

```bash
git pull
npm install
npm run setup -- --test
npm run verify
npm audit
npm run doctor
```

Kontroller temizse:

```bash
npm start
```

## `.env`

Yeni proje izleme alanları yoksa `config.example.env` ile karşılaştırın. `UPDATE_CHANNEL_ID` ve `REPORT_CHANNEL_ID` boş bırakılırsa yapılandırma uygun olduğunda log/admin kanalına fallback uygulanır.

## Discord izinleri

`Server Members Intent` açık kalmalıdır.

OAuth2 scopes:

- `bot`
- `applications.commands`

Bot kanallarında:

- View Channel
- Send Messages
- Embed Links
- Attach Files

`Administrator` gerekli değildir.

## Yayın modeli

v2.2.1 self-hosted ve tek `GUILD_ID`/tek bot süreci modelini kullanır. Merkezi multi-server hosted bot desteği bu sürümün kapsamında değildir.

## Release öncesi kilit dosyası

`package.json` güncellendiği için bir kez `npm install` çalıştırın ve oluşan/güncellenen `package-lock.json` dosyasını commit edin. Sonraki kurulumlar ve CI `npm ci` kullanır.

```powershell
npm install
npm run verify
npm audit
npm run doctor
```
