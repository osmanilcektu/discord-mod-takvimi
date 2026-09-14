# Contributing

Katkılar için teşekkürler. Değişikliklerin güvenli, incelenebilir ve test edilebilir kalması için aşağıdaki akışı kullanın.

## Geliştirme Ortamı

- Node.js 20.17+
- npm

```bash
npm ci
cp config.example.env .env
npm run verify
npm audit
```

Gerçek Discord tokenlarını test dosyalarına, issue'lara, loglara veya commitlere eklemeyin.

## Branch

Örnekler:

```text
fix/survey-deadline
feat/workload-report
docs/install-guide
```

## Pull Request Öncesi

Aşağıdaki komutların başarılı olması gerekir:

```bash
npm run verify
npm audit
```

Değişiklik Discord davranışını etkiliyorsa PR açıklamasında şunları belirtin:

- ne değişti;
- neden değişti;
- hangi komut/akış etkilendi;
- nasıl test edildi;
- varsa geriye dönük uyumluluk etkisi.

## Veritabanı Değişiklikleri

SQLite şema değişiklikleri mevcut kullanıcı verisini silmemelidir. Gerekliyse migration/migration-benzeri geçiş ekleyin ve eski veriyi koruyun.

## Scheduler Değişiklikleri

Yeni cron görevi eklerken:

- aynı işin iki kez schedule edilmediğinden;
- task referansının `stop()` sırasında kapatılabildiğinden;
- yeniden başlatma sonrasında yarım kalan durumun veritabanından kurtarılabildiğinden

emin olun.

## Güvenlik

Hassas güvenlik açıkları için public issue açmayın. `SECURITY.md` içindeki private reporting yolunu kullanın.

## Lisans

Pull Request göndererek katkınızın repository'nin MIT lisansı altında dağıtılabileceğini kabul etmiş olursunuz.
