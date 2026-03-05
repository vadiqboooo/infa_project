#!/bin/bash
DOMAIN="rancheasy.ru"
EMAIL="vadiqbozhko@gmail.com"

echo "### 1. Перезапуск nginx в режиме HTTP..."
docker compose up -d nginx

echo "### 2. Получение сертификата через certbot..."
docker compose run --rm certbot certonly --webroot --webroot-path=/var/lib/letsencrypt/ --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN

if [ $? -eq 0 ]; then
    echo "### 3. Сертификат успешно получен! Возвращаем конфиг со SSL..."
    
    # Записываем полный конфиг обратно в nginx/conf.d/default.conf
    cat <<EOF > nginx/conf.d/default.conf
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt/;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH';

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        rewrite ^/api/(.*) /\$1 break;
    }
}
EOF

    echo "### 4. Перезагрузка nginx со SSL..."
    docker compose exec nginx nginx -s reload
    echo "### Готово! Проект доступен по адресу https://$DOMAIN"
else
    echo "### ОШИБКА: Не удалось получить сертификат. Проверьте логи certbot и убедитесь, что домен $DOMAIN указывает на ваш сервер."
fi
