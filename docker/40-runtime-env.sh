#!/bin/sh
# Runs automatically before nginx starts (official image: /docker-entrypoint.d/).
# Generates env.js from the container environment so the same image can be
# configured per environment without rebuilding.
set -eu

TEMPLATE=/etc/nginx/env.template.js
TARGET=/usr/share/nginx/html/env.js

# Only these variables are substituted; any other ${...} text is left untouched.
envsubst '${API_URL} ${TURNSTILE_SITE_KEY} ${PUBLIC_URL}' < "$TEMPLATE" > "$TARGET"

echo "runtime-env: generated $TARGET"
