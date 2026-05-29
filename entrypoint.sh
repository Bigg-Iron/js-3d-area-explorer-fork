#!/bin/sh

# Copyright 2026 Google LLC
# Secure container runtime entrypoint script

# ALWAYS recreate env.js from the example template if it exists
if [ -f env.example.js ]; then
  cp env.example.js env.js
  
  # Ensure GOOGLE_MAPS_API_KEY environment variable is provided
  if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "⚠️ WARNING: GOOGLE_MAPS_API_KEY environment variable is not set."
    echo "⚠️ env.js remains at default."
  else
    echo "✅ Detected GOOGLE_MAPS_API_KEY. Cleaning quotes and injecting into env.js..."
    CLEANED_KEY=$(echo "$GOOGLE_MAPS_API_KEY" | tr -d '"' | tr -d "'")
    sed -i "s|<API_KEY>|${CLEANED_KEY}|g" env.js
    echo "✅ env.js successfully populated at runtime."
  fi
else
  echo "ℹ️ React mode active: No env.example.js found in root. API keys will be served dynamically via /api/config."
fi

# Execute the passed CMD (e.g. http-server)
exec "$@"
