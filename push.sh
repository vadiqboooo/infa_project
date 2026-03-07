#!/bin/bash
# Быстрый коммит и пуш в git
# Использование:
#   ./push.sh              # коммит с сообщением "update"
#   ./push.sh "fix login"  # коммит с кастомным сообщением

MSG="${1:-update}"

git add -A
git commit -m "$MSG"
git push

echo ""
echo "Done: '$MSG' pushed to $(git branch --show-current)"
