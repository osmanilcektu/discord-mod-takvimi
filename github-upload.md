# GitHub Yayın Rehberi

Hedef repository: `https://github.com/osmanilcektu/discord-mod-takvimi`

## Yayın öncesi zorunlu kontroller

Gerçek `.env`, `data/`, `logs/` ve `node_modules/` repository'ye eklenmemelidir. `package-lock.json` ise **commit edilmelidir**.

```powershell
npm install
npm run setup -- --test
npm run verify
npm audit
npm run doctor
```

Canlı Discord testinde en az şunları kontrol edin:

```text
/yardim
/mod
/admin permissions
/admin modlari-guncelle
/admin mod-listesi
/admin sistem-durumu
/admin proje-istatistik
/admin guncelleme-kontrol
```

`Unknown interaction`, deprecated `ephemeral`, `Missing Access`, `Used disallowed intents` veya kanal izin hatası kalmamalıdır.

## Git kontrolü

```powershell
git status --short
git check-ignore -v .env
git ls-files .env data logs node_modules
```

Son komut hiçbir hassas/runtime dosyası göstermemelidir.

## Main branch'e gönderme

```powershell
git add .
git status --short
git commit -m "Release v2.2.1: harden interactions and publishing"
git push origin main
```

GitHub Actions `Node.js CI` iş akışının Node 20, 22 ve 24 üzerinde yeşil olduğunu doğrulayın. CI yeşil olmadan release etiketi oluşturmayın.

## v2.2.1 release

CI başarılı olduktan sonra:

```powershell
git tag -a v2.2.1 -m "v2.2.1"
git push origin v2.2.1
```

`.github/workflows/release.yml` etiketi doğrular, temiz kurulum yapar, statik kontrolleri/testleri/güvenlik denetimini çalıştırır ve GitHub Release'e `discord-mod-takvimi-v2.2.1.zip` asset'ini ekler.

## Kimlik doğrulama

GitHub HTTPS push sırasında kimlik doğrulama isterse Git Credential Manager / tarayıcı tabanlı GitHub oturum açma akışını kullanın. Kişisel erişim anahtarlarını proje dosyalarına, `.env` içine veya komut geçmişine yazmayın.
