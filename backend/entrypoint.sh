#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  until python -c "
import psycopg2, os, sys
try:
    psycopg2.connect(
        dbname=os.environ.get('DB_NAME', 'gacm_contracts'),
        user=os.environ.get('DB_USER', 'gacm'),
        password=os.environ.get('DB_PASSWORD', 'gacm'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432'),
    )
except Exception:
    sys.exit(1)
"; do
    sleep 1
  done
  echo "Database is up."
fi

python manage.py migrate --noinput

if [ "$SEED_DEMO_DATA" = "true" ] || [ "$SEED_DEMO_DATA" = "True" ]; then
  echo "SEED_DEMO_DATA=true: cargando usuarios de prueba..."
  python manage.py seed_users
else
  echo "SEED_DEMO_DATA no está activo, se omite la carga de datos de prueba."
fi

exec python manage.py runserver 0.0.0.0:8000
