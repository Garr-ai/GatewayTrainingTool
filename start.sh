#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"

# Check Node and npm are available
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Install it via nvm or https://nodejs.org" >&2
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "Error: npm is not installed." >&2
  exit 1
fi

echo "Node: $(node -v)  npm: $(npm -v)"

# Check .env exists
if [ ! -f "$WEB_DIR/.env" ]; then
  if [ -f "$WEB_DIR/.env.example" ]; then
    echo ""
    echo "Warning: web/.env not found. Copying from .env.example..."
    cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
    echo "  -> Edit web/.env and add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before continuing."
    echo ""
  else
    echo ""
    echo "Warning: web/.env not found. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    echo ""
  fi
fi

# Install dependencies if node_modules is missing or package.json changed
echo "Installing dependencies..."
npm install --prefix "$WEB_DIR"

# Start dev server
echo ""
echo "Starting Vite dev server..."
npm run dev --prefix "$WEB_DIR"
