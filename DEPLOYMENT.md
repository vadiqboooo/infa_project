# Перенос проекта на новый VPS

Ниже один конкретный вариант:

- VPS работает на Ubuntu 22.04 или 24.04;
- PostgreSQL устанавливается прямо на VPS;
- проект запускается через Docker Compose;
- база называется `edu_platform`;
- пользователь базы — `edu_user`;
- проект находится в `/opt/infa_project`.

Заменяйте `NEW_SERVER_IP`, `OLD_SERVER_IP` и `СЛОЖНЫЙ_ПАРОЛЬ` своими значениями.

## 1. Подключиться к новому серверу

На своём компьютере:

```bash
ssh root@NEW_SERVER_IP
```

Команды следующих разделов выполняются уже на новом VPS.

## 2. Установить Docker

```bash
apt update
apt install -y ca-certificates curl git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Проверка:

```bash
docker --version
docker compose version
```

Обе команды должны вывести версии без ошибок.

## 3. Установить PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
systemctl status postgresql --no-pager
```

В результате должно быть `active (exited)` или `active (running)`.

## 4. Создать пользователя и пустую базу

Придумайте сложный пароль из латинских букв и цифр. Он понадобится дальше.

```bash
sudo -u postgres psql
```

В открывшейся консоли PostgreSQL выполните:

```sql
CREATE USER edu_user WITH PASSWORD 'Cvdfer34';
CREATE DATABASE edu_platform OWNER edu_user;
\q
```

Проверка:

```bash
sudo -u postgres psql -d edu_platform -c "SELECT current_database();"
```

В ответе должно появиться `edu_platform`.

## 5. Разрешить Docker-контейнеру подключаться к PostgreSQL

Backend работает внутри Docker. Поэтому PostgreSQL нужно разрешить соединения из сети Docker.

```bash
PG_CONF=$(sudo -u postgres psql -tAc "SHOW config_file;" | xargs)
PG_HBA=$(sudo -u postgres psql -tAc "SHOW hba_file;" | xargs)

echo "$PG_CONF"
echo "$PG_HBA"
```

Измените `listen_addresses`:

```bash
sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
```

Разрешите подключение пользователя `edu_user` из стандартных подсетей Docker:

```bash
echo "host    edu_platform    edu_user    172.16.0.0/12    scram-sha-256" >> "$PG_HBA"
systemctl restart postgresql
```

Проверка порта:

```bash
ss -lntp | grep 5432
```

Порт 5432 не нужно открывать в интернет. Если используете UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
ufw deny 5432/tcp
ufw --force enable
```

Первое правило для 5432 разрешает доступ только контейнерам Docker. Второе запрещает доступ к PostgreSQL из интернета.

## 6. Сделать backup на старом сервере

Откройте второй терминал и подключитесь к старому VPS:

```bash
ssh root@OLD_SERVER_IP
```

Чтобы после создания дампа в старой базе не появились новые данные, остановите backend и создайте дамп:

```bash
cd /opt/infa_project
docker compose stop backend

sudo -u postgres pg_dump \
  -Fc \
  --no-owner \
  --no-acl \
  edu_platform > /tmp/edu_platform.dump
```

Проверьте его:

```bash
ls -lh /tmp/edu_platform.dump
pg_restore --list /tmp/edu_platform.dump > /dev/null && echo "Дамп исправен"
```

До окончания переноса старый backend не запускайте. Если вы отменили перенос, верните его командой `docker compose start backend`.

## 7. Скопировать backup на новый сервер

Выполните на своём компьютере:

```bash
scp root@OLD_SERVER_IP:/tmp/edu_platform.dump ./edu_platform.dump
scp ./edu_platform.dump root@NEW_SERVER_IP:/tmp/edu_platform.dump
```

Снова зайдите на новый VPS:

```bash
ssh root@NEW_SERVER_IP
```

Проверьте полученный файл:

```bash
ls -lh /tmp/edu_platform.dump
pg_restore --list /tmp/edu_platform.dump > /dev/null && echo "Дамп исправен"
```

## 8. Развернуть базу из backup

Удалите пустую базу, создайте её заново и восстановите данные:

```bash
sudo -u postgres dropdb --if-exists edu_platform
sudo -u postgres createdb --owner=edu_user edu_platform

sudo -u postgres pg_restore \
  --role=edu_user \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --dbname=edu_platform \
  /tmp/edu_platform.dump
```

Проверьте таблицы и пользователей:

```bash
sudo -u postgres psql -d edu_platform -c "\dt"
sudo -u postgres psql -d edu_platform -c "SELECT count(*) FROM users;"
```

Если таблицы появились и второй запрос вернул число, база успешно развёрнута.

## 9. Скачать проект

```bash
cd /opt
git clone https://github.com/vadiqboooo/infa_project.git
cd /opt/infa_project
```

Если проект уже скачан:

```bash
cd /opt/infa_project
git pull
```

## 10. Настроить server/.env

```bash
nano /infa_project/server/.env
```

Минимальный пример:

```dotenv
DATABASE_URL=postgresql+asyncpg://edu_user:СЛОЖНЫЙ_ПАРОЛЬ@host.docker.internal:5432/edu_platform
JWT_SECRET=ДЛИННАЯ_СЛУЧАЙНАЯ_СТРОКА
BOT_TOKEN=
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_VISION_MODEL=gpt-4o-mini
PARSER_API_KEY=
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_API_URL=https://api.yookassa.ru/v3
PAYMENT_RETURN_URL=https://rancheasy.ru/home
```

Используйте тот пароль, который указали при создании `edu_user`.

Значения `JWT_SECRET`, `BOT_TOKEN`, ключей LLM и ЮKassa перенесите из старого `server/.env`. Если сохранить прежний `JWT_SECRET`, пользователям не придётся заново входить в аккаунт.

```bash
chmod 600 /opt/infa_project/server/.env
```

## 11. Настроить docker-compose.yml

Откройте файл:

```bash
nano /opt/infa_project/docker-compose.yml
```

Сервис `backend` должен выглядеть так:

```yaml
services:
  backend:
    build: ./server
    restart: always
    extra_hosts:
      - "host.docker.internal:host-gateway"
    env_file:
      - ./server/.env
    volumes:
      - ./server:/app
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

Обязательно удалите старую секцию с захардкоженными значениями:

```yaml
environment:
  DATABASE_URL: ...
  JWT_SECRET: ...
```

Если её оставить, она перекроет значения из `server/.env`.

## 12. Запустить проект

```bash
cd /opt/infa_project
docker compose up -d --build
docker compose ps
```

Посмотрите журнал backend:

```bash
docker compose logs --tail=100 backend
```

Проверьте API:

```bash
curl -i -H "Host: rancheasy.ru" http://127.0.0.1/api/
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

Если backend не подключается к базе:

```bash
docker compose logs --tail=200 backend
journalctl -u postgresql --no-pager -n 100
```

## 13. Подключиться к базе через DBeaver

Порт 5432 не открывайте в интернет. На своём компьютере создайте SSH-туннель:

```bash
ssh -L 5433:127.0.0.1:5432 root@NEW_SERVER_IP
```

Пока терминал с туннелем открыт, создайте соединение в DBeaver:

```text
Host: localhost
Port: 5433
Database: edu_platform
Username: edu_user
Password: СЛОЖНЫЙ_ПАРОЛЬ
```

## 14. Не забыть про загруженные файлы

Файлы из `server/uploads` в PostgreSQL не хранятся. Их нужно перенести отдельно.

На старом VPS:

```bash
cd /opt/infa_project
tar -czf /tmp/uploads.tar.gz -C server uploads
```

На компьютере:

```bash
scp root@OLD_SERVER_IP:/tmp/uploads.tar.gz ./uploads.tar.gz
scp ./uploads.tar.gz root@NEW_SERVER_IP:/tmp/uploads.tar.gz
```

На новом VPS:

```bash
cd /opt/infa_project
docker compose stop backend
tar -xzf /tmp/uploads.tar.gz -C server
docker compose start backend
```

## Итоговая схема

```text
Docker Nginx -> Docker frontend
       |
       v
Docker backend
       |
       | host.docker.internal:5432
       v
PostgreSQL на VPS
```

Строка подключения backend:

```text
postgresql+asyncpg://edu_user:ПАРОЛЬ@host.docker.internal:5432/edu_platform
```

Справка: [Docker для Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
