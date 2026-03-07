#!/bin/bash
# Серверный скрипт обновления
# Запускать на сервере: bash update.sh
# Или с флагом: bash update.sh --no-cache (для полной пересборки)

set -e

COMPOSE="docker compose"
NO_CACHE=""

if [[ "$1" == "--no-cache" ]]; then
    NO_CACHE="--no-cache"
    echo "[update] Режим полной пересборки (--no-cache)"
fi

echo "[update] Получение изменений из git..."
git pull

echo "[update] Сборка и перезапуск контейнеров..."
$COMPOSE build $NO_CACHE backend frontend

echo "[update] Перезапуск сервисов..."
$COMPOSE up -d --no-deps backend frontend

echo "[update] Статус:"
$COMPOSE ps

echo ""
echo "[update] Готово! Сервис обновлён."
