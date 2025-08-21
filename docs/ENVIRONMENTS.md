# Environment Configuration Guide

This guide explains how to set up multiple environments (development, staging, production, etc.) for your Discord Status Bot deployment.

## Current Environments

The project comes with two pre-configured environments:

1. **Development** (`development`) - For local testing and development
2. **Production** (`production`) - For live deployment

## Environment Structure

Each environment in `wrangler.toml` includes:
- Environment-specific variables
- KV namespace bindings
- Deployment configuration

## Adding a New Environment

### Step 1: Create KV Namespace

First, create a new KV namespace for your environment:

```bash
# Create namespace for staging environment
wrangler kv namespace create STATUS_BOT_STORAGE --env staging

# This will output something like:
# ✨ Success! Created KV namespace with ID: abc123def456...
```

Save the generated ID - you'll need it in the next step.

### Step 2: Add Environment Configuration

Edit `wrangler.toml` and add your new environment configuration:

```toml
[env.staging]
vars = { 
  ENVIRONMENT = "staging",
  DISCORD_API_VERSION = "v10",
  DISCORD_PUBLIC_KEY = "your_staging_public_key_here",
  STATUS_CHANNEL_ID = "your_staging_channel_id_here",
  LLM_MODEL = "claude-3-5-haiku-latest",
  LLM_MAX_TOKENS = "1000",
  LLM_TEMPERATURE = "0.1"
}

[[env.staging.kv_namespaces]]
binding = "STATUS_BOT_STORAGE"
id = "abc123def456..."  # Use the ID from Step 1
preview_id = "abc123def456..."  # Same ID for preview
```

### Step 3: Configure Secrets

Add secrets for your new environment:

```bash
# Add Discord bot token for staging
wrangler secret put DISCORD_BOT_TOKEN --env staging

# Add Discord application ID
wrangler secret put DISCORD_APPLICATION_ID --env staging

# Add LLM credentials (format: provider:api_key)
wrangler secret put LLM_CREDENTIALS --env staging
```

### Step 4: Update Package Scripts (Optional)

Add deployment scripts to `package.json`:

```json
{
  "scripts": {
    "deploy:staging": "wrangler deploy --env staging",
    "tail:staging": "wrangler tail --env staging"
  }
}
```

### Step 5: Deploy to New Environment

```bash
# Deploy to your new environment
npm run deploy:staging

# Or directly with wrangler
wrangler deploy --env staging
```

## Environment-Specific Configurations

### Required Variables

Each environment MUST have these variables configured:

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | `"staging"` |
| `DISCORD_API_VERSION` | Discord API version | `"v10"` |
| `DISCORD_PUBLIC_KEY` | Bot's public key for verification | `"abc123..."` |
| `STATUS_CHANNEL_ID` | Discord channel for status updates | `"123456789"` |
| `LLM_MODEL` | Default LLM model | `"claude-3-5-haiku-latest"` |
| `LLM_MAX_TOKENS` | Max tokens for LLM responses | `"1000"` |
| `LLM_TEMPERATURE` | LLM temperature setting | `"0.1"` |

### Required Secrets

Each environment MUST have these secrets:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `DISCORD_BOT_TOKEN` | Bot authentication token | Discord Developer Portal → Bot → Token |
| `DISCORD_APPLICATION_ID` | Application ID | Discord Developer Portal → General Information |
| `LLM_CREDENTIALS` | LLM API credentials | Format: `provider:api_key` |

### LLM Credentials Format

The `LLM_CREDENTIALS` secret supports multiple providers:

```bash
# Single provider
anthropic:sk-ant-api03-xxxxx

# Multiple providers (comma-separated)
anthropic:sk-ant-api03-xxxxx,openai:sk-xxxxx,openrouter:sk-or-xxxxx
```

## Common Environment Patterns

### 1. Basic Three-Tier Setup

```toml
# Development - Local testing
[env.development]
vars = { ENVIRONMENT = "development", ... }

# Staging - Pre-production testing
[env.staging]
vars = { ENVIRONMENT = "staging", ... }

# Production - Live deployment
[env.production]
vars = { ENVIRONMENT = "production", ... }
```

### 2. Feature Branch Environments

```toml
# Feature branch for testing new LLM provider
[env.feature-llm]
vars = { 
  ENVIRONMENT = "feature-llm",
  LLM_MODEL = "gpt-4-turbo-preview",
  ...
}
```

### 3. Regional Deployments

```toml
# US deployment
[env.production-us]
vars = { 
  ENVIRONMENT = "production-us",
  STATUS_CHANNEL_ID = "us_channel_id",
  ...
}

# EU deployment
[env.production-eu]
vars = { 
  ENVIRONMENT = "production-eu",
  STATUS_CHANNEL_ID = "eu_channel_id",
  ...
}
```

## Environment Management Commands

### Deployment Commands

```bash
# Deploy to specific environment
wrangler deploy --env <environment-name>

# Examples
wrangler deploy --env development
wrangler deploy --env staging
wrangler deploy --env production
```

### Monitoring Commands

```bash
# Tail logs for specific environment
wrangler tail --env <environment-name>

# View KV data
wrangler kv key list --namespace-id <namespace-id>
```

### Secret Management

```bash
# List secrets for environment
wrangler secret list --env <environment-name>

# Update a secret
wrangler secret put <SECRET_NAME> --env <environment-name>

# Delete a secret
wrangler secret delete <SECRET_NAME> --env <environment-name>
```

## Best Practices

### 1. Environment Naming

- Use clear, descriptive names: `development`, `staging`, `production`
- For feature branches: `feature-<feature-name>`
- For regional: `production-<region>`

### 2. Configuration Management

- **Never commit secrets** to version control
- Use different Discord servers/channels for each environment
- Keep development LLM limits lower to control costs
- Use stricter rate limits in development

### 3. Deployment Strategy

```bash
# Recommended deployment flow
Development → Staging → Production

# 1. Test in development
npm run deploy:dev

# 2. Validate in staging
npm run deploy:staging

# 3. Deploy to production
npm run deploy:prod
```

### 4. Environment Isolation

- Use separate Discord applications for each environment
- Use separate KV namespaces to prevent data conflicts
- Use environment-specific webhook URLs

## Troubleshooting

### Issue: "Namespace not found"

**Solution**: Ensure KV namespace is created and ID is correct:
```bash
wrangler kv namespace list
```

### Issue: "Invalid Discord signature"

**Solution**: Verify `DISCORD_PUBLIC_KEY` matches your Discord app:
1. Go to Discord Developer Portal
2. Select your application
3. Copy the public key from General Information
4. Update in `wrangler.toml`

### Issue: "LLM credentials invalid"

**Solution**: Check secret format:
```bash
# Correct format
wrangler secret put LLM_CREDENTIALS --env staging
# Enter: anthropic:sk-ant-api03-xxxxx
```

### Issue: "Environment not found"

**Solution**: Ensure environment is defined in `wrangler.toml`:
```bash
# Check available environments
grep "^\[env\." wrangler.toml
```

## Environment Variables Reference

### Core Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | ✅ | - | Environment identifier |
| `DISCORD_API_VERSION` | ✅ | `v10` | Discord API version |
| `DISCORD_PUBLIC_KEY` | ✅ | - | Bot public key |
| `STATUS_CHANNEL_ID` | ✅ | - | Status channel ID |

### LLM Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_MODEL` | ✅ | `claude-3-5-haiku-latest` | Default model |
| `LLM_MAX_TOKENS` | ❌ | `1000` | Max response tokens |
| `LLM_TEMPERATURE` | ❌ | `0.1` | Creativity level |
| `LLM_TIMEOUT` | ❌ | `30000` | Timeout in ms |

### Feature Flags (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_STATS` | `true` | Enable statistics collection |
| `ENABLE_HEALTH_CHECK` | `true` | Enable health endpoint |
| `DEBUG_MODE` | `false` | Enable debug logging |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |

## Example: Complete Staging Environment

Here's a complete example of adding a staging environment:

```toml
# In wrangler.toml
[env.staging]
vars = { 
  ENVIRONMENT = "staging",
  DISCORD_API_VERSION = "v10",
  DISCORD_PUBLIC_KEY = "a1b2c3d4e5f6...",
  STATUS_CHANNEL_ID = "1234567890123456",
  LLM_MODEL = "claude-3-5-haiku-latest",
  LLM_MAX_TOKENS = "800",
  LLM_TEMPERATURE = "0.2",
  ENABLE_STATS = "true",
  ENABLE_HEALTH_CHECK = "true",
  DEBUG_MODE = "true",
  RATE_LIMIT_ENABLED = "false"
}

[[env.staging.kv_namespaces]]
binding = "STATUS_BOT_STORAGE"
id = "staging_kv_namespace_id_here"
preview_id = "staging_kv_namespace_id_here"
```

```bash
# Set up secrets
wrangler secret put DISCORD_BOT_TOKEN --env staging
wrangler secret put DISCORD_APPLICATION_ID --env staging
wrangler secret put LLM_CREDENTIALS --env staging

# Deploy
wrangler deploy --env staging

# Monitor
wrangler tail --env staging
```

## Conclusion

With this flexible environment system, you can:
- Test changes safely in development
- Validate in staging before production
- Run multiple versions simultaneously
- Deploy region-specific instances
- Create temporary feature environments

Remember to always test in a non-production environment first!