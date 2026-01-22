#!/bin/sh
# scripts/init_db.sh

# Ensure we are in the demo-app directory
cd /app/demo-app

echo "Initializing D1 database..."
# Initial setup usually requires creating the database if it doesn't strictly exist in config
# But for local dev, wrangler handles it when referenced.
# We execute the schema.
npx wrangler d1 execute demo-db --local --file=./schema.sql

echo "Database initialized."
