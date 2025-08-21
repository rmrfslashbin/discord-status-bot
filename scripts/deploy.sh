#!/bin/bash

# Deployment Script for Discord Status Bot
# Handles validation, building, and deployment to Cloudflare Workers

set -e  # Exit on any error

# Default environment
ENVIRONMENT="production"
CONFIG_FILE="wrangler.toml"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--env ENVIRONMENT] [--config CONFIG_FILE]"
            echo ""
            echo "Options:"
            echo "  --env ENVIRONMENT    Deployment environment (default: production)"
            echo "  --config CONFIG_FILE Wrangler config file (default: wrangler.toml)"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Deploy to production"
            echo "  $0 --env development         # Deploy to development"
            echo "  $0 --config wrangler.dev.toml --env development"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Deploying Discord Status Bot to environment: $ENVIRONMENT"

# Validate configuration file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Pre-deployment validation
echo "🔍 Running pre-deployment validation..."

# Run linting
echo "  📝 Checking code style..."
npm run lint

# Check formatting
echo "  🎨 Checking code formatting..."
npm run format:check

# Run tests
echo "  🧪 Running tests..."
npm run test

# Validate wrangler configuration
echo "  ⚙️  Validating Wrangler configuration..."
npx wrangler deploy --config "$CONFIG_FILE" --env "$ENVIRONMENT" --dry-run

# Check for required secrets (non-interactive check)
echo "  🔐 Checking deployment readiness..."
if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  Deploying to PRODUCTION environment"
    echo "   Make sure these secrets are set via 'wrangler secret put':"
    echo "   - DISCORD_APPLICATION_ID"
    echo "   - DISCORD_BOT_TOKEN" 
    echo "   - DISCORD_PUBLIC_KEY"
    echo "   - LLM_CREDENTIALS"
    echo ""
    read -p "Continue with deployment? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Deploy
echo "🚀 Deploying to Cloudflare Workers..."
if [ "$ENVIRONMENT" = "production" ]; then
    npx wrangler deploy --config "$CONFIG_FILE" --env "$ENVIRONMENT"
else
    npx wrangler deploy --config "$CONFIG_FILE" --env "$ENVIRONMENT"
fi

# Post-deployment validation
echo "✅ Deployment completed successfully!"
echo ""
echo "Post-deployment checklist:"
echo "1. Test bot functionality in Discord"
echo "2. Check health endpoint: /status health"
echo "3. Monitor logs: npx wrangler tail --env $ENVIRONMENT"
echo "4. Verify metrics: /status stats"
echo ""
echo "🎉 Discord Status Bot is now live in $ENVIRONMENT!"