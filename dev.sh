#!/bin/bash

# Copyright 2026 Google LLC
# Local development script for the Spatial Operations Dashboard

# Check for .env file
if [ ! -f .env ]; then
  echo "⚠️ .env file not found. Creating it from .env.example..."
  cp .env.example .env
  echo "👉 Please edit the .env file in the root folder and add your GOOGLE_MAPS_API_KEY."
  exit 1
fi

# Load environment variables from .env
# This supports keys with or without quotes
API_KEY=$(grep -E "^GOOGLE_MAPS_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$API_KEY" ] || [ "$API_KEY" = "AIzaSyYourKeyHere..." ]; then
  echo "❌ Error: GOOGLE_MAPS_API_KEY is not configured in your .env file."
  echo "👉 Please edit the .env file and paste a valid Google Maps Platform API key."
  exit 1
fi

# Recreate env.js inside the src directory
cp src/env.example.js src/env.js

# Replace the placeholder in env.js
# Using a different delimiter to handle potential special characters in API Key safely
sed -i '' "s|<API_KEY>|${API_KEY}|g" src/env.js 2>/dev/null || sed -i "s|<API_KEY>|${API_KEY}|g" src/env.js

echo "✅ Environment variables successfully populated in src/env.js"
echo "🚀 Starting local development server on http://localhost:8080..."

# Start http-server serving the 'src' directory
npx http-server src -p 8080 -c-1
