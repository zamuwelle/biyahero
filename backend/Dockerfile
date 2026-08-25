FROM dunglas/frankenphp

WORKDIR /app

# Install system deps, PostgreSQL driver libs, and zip tools
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    libpq-dev \
    && install-php-extensions \
        pcntl \
        pdo_sqlite \
        pdo_pgsql \
        mbstring \
        bcmath \
        zip \
        opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copy composer files first for layer caching
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# Copy the rest of the application
COPY . .

# Ensure view folder exists in production
RUN mkdir -p resources/views

# Ensure SQLite database exists
RUN touch /app/database/database.sqlite && chown www-data:www-data /app/database/database.sqlite

# Set permissions
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

RUN setcap -r /usr/local/bin/frankenphp

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["/entrypoint.sh"]
