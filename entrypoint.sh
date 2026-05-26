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
  echo "✅ Detected GOOGLE_MAPS_API_KEY. Cleaning quotes and injecting into env.js..."
  # Clean any accidental double/single quotes from the environment variable
  CLEANED_KEY=$(echo "$GOOGLE_MAPS_API_KEY" | tr -d '"' | tr -d "'")
  # Substitute the placeholder with the cleaned key
  sed -i "s|<API_KEY>|${CLEANED_KEY}|g" env.js
  echo "✅ env.js successfully populated at runtime."
fi

# Execute the passed CMD (e.g. http-server)
exec "$@"
