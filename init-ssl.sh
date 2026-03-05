#!/bin/bash

# Configuration
DOMAIN="rancheasy.ru"
EMAIL="vadiqbozhko@gmail.com"

# Check if docker and docker-compose are installed
if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

if ! [ -x "$(command -v docker compose)" ]; then
  echo 'Error: docker compose is not installed.' >&2
  exit 1
fi

# 1. Start the nginx service to handle the ACME challenge
echo "### Starting nginx to handle the ACME challenge..."
docker compose up -d nginx

# 2. Run Certbot to get the certificate
echo "### Requesting Let's Encrypt certificate for $DOMAIN..."
docker compose run --rm certbot certonly --webroot --webroot-path=/var/lib/letsencrypt/ --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN

# 3. Reload nginx to apply the new certificate
echo "### Reloading nginx with the new certificate..."
docker compose exec nginx nginx -s reload

echo "### SSL configuration complete for $DOMAIN!"
