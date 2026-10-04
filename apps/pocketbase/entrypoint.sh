#!/bin/sh
set -e

PB="/pb/pocketbase --dir=/pb_data --migrationsDir=/pb/pb_migrations"

# Superusuário usado pela API (convites, lembretes, exclusão de conta); criado ou atualizado a cada início
if [ -n "$PB_SUPERUSER_EMAIL" ] && [ -n "$PB_SUPERUSER_PASSWORD" ]; then
  $PB superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD"
fi

exec $PB serve --http=0.0.0.0:8090 --automigrate=false
