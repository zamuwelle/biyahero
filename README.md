# Biyahero

## Setting up Locally

```bash
git clone https://github.com/zamuwelle/biyahero.git
```

### Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

For devs, see [backend/README.md](backend/README.md).

### Mobile

```sh
cd mobile
cp .env.example .env
npm install --legacy-peer-deps
npx expo start
```

Press `s` to switch to Expo Go mode, then `A` for Android or `I` for iOS simulator.

### Building

**Local (faster, requires Android SDK):**
```sh
cd mobile
npx expo run:android                   # debug build
npx expo run:android --variant release # release APK
```

**EAS Cloud (no Android SDK needed):**
```sh
cd mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
