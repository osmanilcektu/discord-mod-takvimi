# v2.2.0 Yükseltme Notu

Bu sürüm mevcut `.env`, `data/` ve `logs/` dosyalarınızı değiştirmeden proje kodunun üzerine uygulanabilir.

## Yeni `.env` değerleri

```env
GITHUB_REPOSITORY=osmanilcektu/discord-mod-takvimi
UPDATE_CHECK_ENABLED=true
UPDATE_CHECK_INTERVAL_HOURS=6
UPDATE_CHANNEL_ID=

REPORTING_ENABLED=true
STARTUP_REPORT_ENABLED=true
DAILY_REPORT_ENABLED=true
DAILY_REPORT_HOUR=9
REPORT_CHANNEL_ID=
```

`UPDATE_CHANNEL_ID` ve `REPORT_CHANNEL_ID` boş bırakılırsa sırasıyla `LOG_CHANNEL_ID` / `ADMIN_MOD_CHANNEL_ID` fallback olarak kullanılır.

## Kontrol sırası

```powershell
npm install
npm run check
npm test
npm run doctor
npm run update:check
npm start
```

## Yeni Discord yönetici komutları

- `/admin sistem-durumu`
- `/admin guncelleme-kontrol`
- `/admin proje-istatistik`
- `/admin rapor-gonder`
- `/admin mod-listesi`

Güncelleme sistemi yalnızca yeni GitHub Release bulunduğunu bildirir. Kendiliğinden dosya indirme, `git pull`, `npm install` veya uzaktan kod çalıştırma yapmaz.
