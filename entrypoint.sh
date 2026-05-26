#!/bin/sh

# Copyright 2026 Google LLC
# Secure container runtime entrypoint script

# ALWAYS recreate env.js from the example template to prevent browser 404 module import failures
cp env.example.js env.js

# Ensure GOOGLE_MAPS_API_KEY environment variable is provided
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
  echo "⚠️ WARNING: GOOGLE_MAPS_API_KEY environment variable is not set."
  echo "⚠️ env.js remains at default. Google Maps Platform layers may fail to render."
else
  echo "✅ Detected GOOGLE_MAPS_API_KEY. Injecting into env.js..."
  # Substitute the placeholder with the environment variable
  sed -i "s|<API_KEY>|${GOOGLE_MAPS_API_KEY}|g" env.js
  echo "✅ env.js successfully populated at runtime."
fi

# Execute the passed CMD (e.g. http-server)
exec "$@"
