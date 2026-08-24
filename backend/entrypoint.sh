#!/bin/sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

php artisan migrate --force

php artisan tinker --execute="if (\App\Models\Vehicle::count() === 0) { Artisan::call('db:seed', ['--class' => 'DatabaseSeeder', '--force' => true]); echo 'Seeded.'; } else { echo 'Already seeded, skipping.'; }"

php artisan serve --host=0.0.0.0 --port=${PORT:-8001}