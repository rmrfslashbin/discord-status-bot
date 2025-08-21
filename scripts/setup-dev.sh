#!/bin/bash

# Development Setup Script for Discord Status Bot
# This script sets up the development environment

set -e  # Exit on any error

echo "🚀 Setting up Discord Status Bot development environment..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "✅ Node.js version $NODE_VERSION meets requirements (>= $REQUIRED_VERSION)"
else
    echo "❌ Node.js version $NODE_VERSION is too old. Required: >= $REQUIRED_VERSION"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install wrangler globally if not present
if ! command -v wrangler >/dev/null 2>&1; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
else
    echo "✅ Wrangler CLI already installed"
fi

# Create .env.example if it doesn't exist
if [ ! -f .env.example ]; then
    echo "❌ .env.example file is missing!"
    exit 1
fi

# Create .dev.vars from .env.example if it doesn't exist
if [ ! -f .dev.vars ]; then
    echo "📝 Creating .dev.vars from .env.example..."
    cp .env.example .dev.vars
    echo "⚠️  Please edit .dev.vars with your actual development credentials"
else
    echo "✅ .dev.vars already exists"
fi

# Run validation
echo "🔍 Running project validation..."
npm run validate

# Run tests
echo "🧪 Running tests..."
npm run test

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .dev.vars with your Discord and LLM credentials"
echo "2. Create Discord application: https://discord.com/developers/applications"
echo "3. Set up Cloudflare KV namespace: npx wrangler kv:namespace create STATUS_BOT_STORAGE"
echo "4. Register Discord commands: npm run register:commands"
echo "5. Start development server: npm run dev"
echo ""
echo "📚 See CONTRIBUTING.md for detailed setup instructions"