#!/usr/bin/env bash
set -euo pipefail

# Build the web app
bun run build:web

# Deploy to Cloudflare Pages
# Project name must match your Cloudflare Pages project.
# Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in environment.
bunx wrangler pages deploy web-build --project-name=orbit
