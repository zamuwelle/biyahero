#!/bin/sh
set -e

# Cache config, routes, and views for production performance
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations (works for both SQLite locally and PostgreSQL on Render)
php artisan migrate --force

# Seed only if the database is empty (safe to run on every deploy)
php artisan db:seed --class=DatabaseSeeder --force

# Start the server
php artisan serve --host=0.0.0.0 --port=8000
