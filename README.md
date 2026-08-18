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
```bash
cd mobile
npm install
npm run start
```