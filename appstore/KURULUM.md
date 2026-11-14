# Abyss Diver → App Store: adım adım kurulum

Mac gerekmez. Uygulama GitHub'ın Mac makinelerinde derlenir ve otomatik olarak App Store Connect'e (TestFlight) yüklenir.
Aşağıdakiler sadece hesap sahibinin yapabileceği işler. Bir kez yapılır; sonraki güncellemelerde sadece 5. adımdaki butona basılır.

Uygulama kimliği (Bundle ID): **`tr.rahimov.abyssdiver`**

---

## 1. Apple Developer — uygulama kimliğini kaydet
1. https://developer.apple.com/account → **Membership details** → **Team ID**'yi kopyala (10 karakter, örn. `AB12CD34EF`). Bunu 4. adımda kullanacağız.
2. **Certificates, IDs & Profiles** → **Identifiers** → **+**
3. **App IDs** → **App** → Continue
4. Description: `Abyss Diver` · Bundle ID: **Explicit** → `tr.rahimov.abyssdiver`
5. Capabilities listesinde **Sign In with Apple**'ı işaretle → Continue → Register.

## 2. App Store Connect — uygulamayı oluştur ve API anahtarı al
1. https://appstoreconnect.apple.com → **Apps** → **+** → **New App**
   - Platform: **iOS** · Name: **Abyss Diver** (alınmışsa `Abyss Diver: Pixel Dive`)
   - Primary language: English (U.S.) veya Turkish · Bundle ID: `tr.rahimov.abyssdiver` · SKU: `abyssdiver001` · User Access: Full Access
2. **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+** (ilk seferde "Request Access" çıkarsa onayla)
   - Name: `GitHub` · Access: **Admin** (otomatik imzalama sertifika oluşturabilsin diye)
   - **Download** ile `AuthKey_XXXXXXXXXX.p8` dosyasını indir — **sadece bir kez indirilebilir**, sakla, kimseyle paylaşma.
   - Sayfadaki **Key ID** ve en üstteki **Issuer ID**'yi kopyala.

## 3. Firebase — iOS uygulamasını ekle ve Apple ile girişi aç
1. https://console.firebase.google.com → **abyss-diver** projesi → ⚙️ **Project settings** → **Your apps** → **Add app** → **iOS (Apple)**
   - Apple bundle ID: `tr.rahimov.abyssdiver` · App nickname: `Abyss Diver iOS` → **Register app**
   - **Download GoogleService-Info.plist** → indir. Kalan SDK adımlarını **Next / Continue to console** ile geç (kod tarafı hazır).
2. **Authentication** → **Sign-in method** → **Add new provider** → **Apple** → **Enable** → **Save** (Services ID / OAuth alanlarını **boş bırak**, onlar sadece web için).
3. Google sağlayıcısı zaten açık, dokunma. Firestore kurallarına da dokunmana gerek yok.

## 4. GitHub — 5 gizli anahtarı ekle
https://github.com/rahimov0/abyss-diver/settings/secrets/actions → **New repository secret** (her biri için ayrı ayrı):

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | 1. adımdaki Team ID |
| `ASC_KEY_ID` | 2. adımdaki Key ID |
| `ASC_ISSUER_ID` | 2. adımdaki Issuer ID |
| `ASC_KEY_P8` | `.p8` dosyasını Not Defteri ile aç, **tüm metni** (BEGIN…END satırları dahil) kopyala-yapıştır |
| `GOOGLE_SERVICE_INFO_PLIST` | `GoogleService-Info.plist` dosyasını Not Defteri ile aç, **tüm metni** kopyala-yapıştır |

Bu değerleri sohbete yazma; sadece GitHub'daki bu sayfaya gir.

## 5. Derle ve TestFlight'a gönder
1. https://github.com/rahimov0/abyss-diver/actions → solda **iOS build → TestFlight** → **Run workflow** → **Run workflow**
2. 15–30 dakika sürer. Yeşil tik = build App Store Connect'e gitti. Kırmızı çarpı olursa bana haber ver, logu birlikte okuruz.
3. App Store Connect → **Apps → Abyss Diver → TestFlight**: build 5–30 dk içinde "Processing"ten çıkar.
4. **Internal Testing** → **+** grubu oluştur → kendini ekle → iPhone'una **TestFlight** uygulamasını kur → davetten Abyss Diver'ı yükle ve oyna.
   - Kontrol listesi: oyun açılıyor mu, ses/titreşim, Ayarlar → Sign in with Apple, Sign in with Google, ilerleme eşitleniyor mu (aynı hesapla web'de gir), DELETE ACCOUNT.

## 6. App Store'a gönder
App Store Connect → **Abyss Diver** → **App Store** sekmesi → **iOS App 1.0**:
1. Metinler, kategori, URL'ler, anahtar kelimeler: `appstore/LISTING.md` dosyasından kopyala (İngilizce + Türkçe).
2. Ekran görüntüleri: `appstore/screenshots/iphone-6.9/` → **iPhone 6.9"** alanına, `appstore/screenshots/ipad-13/` → **iPad 13"** alanına sürükle.
3. **App Privacy** → LISTING.md'deki tabloya göre doldur (Name, Email, User ID, Gameplay Content · App Functionality · Linked · Tracking yok) → **Publish**.
4. **Age Rating** → LISTING.md'deki cevaplar.
5. **Pricing and Availability** → Free, tüm ülkeler.
6. **Build** → TestFlight'taki build'i seç.
7. **App Review Information** → iletişim bilgileri + LISTING.md'deki "App Review notes" metni. Demo hesap gerekmez (oyun hesapsız oynanıyor).
8. **Add for Review** → **Submit**. İnceleme genelde 1–3 gün.

## Sonraki güncellemeler
Kodda değişiklik yaptığımızda: `package.json` içindeki `iosVersion`'ı artır (örn. `1.0.1`), sonra 5. adımdaki **Run workflow** butonuna bas ve App Store Connect'te yeni sürüm oluşturup build'i seç.
Web sürümü (abyss-diver.rahimov.tr) eskisi gibi her push'ta otomatik güncellenir.

## Sorun çıkarsa
- **"No REVERSED_CLIENT_ID"**: Firebase'de Google girişi açıkken plist'i tekrar indir ve `GOOGLE_SERVICE_INFO_PLIST` secret'ını güncelle.
- **Uygulamada girişte "API key" hatası**: Google Cloud Console → APIs & Services → Credentials. Plist'teki `API_KEY` web anahtarıyla aynıysa (o anahtar sadece web adreslerine izinli), Firebase'in oluşturduğu **iOS key**'i kullanan plist'i indir veya bana yaz.
- **İmzalama/sertifika hatası**: API anahtarının erişimi **Admin** olmalı ve 1. adımdaki App ID kayıtlı olmalı.
