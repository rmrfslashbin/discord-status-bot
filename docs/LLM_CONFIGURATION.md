# LLM Configuration Guide

## Overview

The Discord Status Bot supports multiple Large Language Model (LLM) providers with flexible configuration options. This document covers all available LLM settings, provider setup, and advanced configuration options.

## Supported Providers

### Anthropic Claude
- **Provider ID**: `anthropic`
- **Default Model**: `claude-3-haiku-20240307`
- **Default Endpoint**: `https://api.anthropic.com/v1/messages`
- **API Key Format**: `sk-ant-api03-xxxxx`

### OpenAI GPT
- **Provider ID**: `openai`
- **Default Model**: `gpt-3.5-turbo`
- **Default Endpoint**: `https://api.openai.com/v1/chat/completions`
- **API Key Format**: `sk-xxxxx`

### OpenRouter
- **Provider ID**: `openrouter`
- **Default Model**: `anthropic/claude-3-haiku`
- **Default Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **API Key Format**: `sk-or-xxxxx`

## Configuration Methods

### 1. Environment Variables

#### Required Configuration
```bash
# LLM Provider Credentials (Required)
# Format: provider:api_key
LLM_CREDENTIALS=anthropic:sk-ant-api03-xxxxx

# Or for other providers:
LLM_CREDENTIALS=openai:sk-xxxxx
LLM_CREDENTIALS=openrouter:sk-or-xxxxx
```

#### Optional Configuration
```bash
# Model Selection (optional - defaults based on provider)
LLM_MODEL=claude-3-haiku-20240307
LLM_MODEL=gpt-3.5-turbo
LLM_MODEL=anthropic/claude-3-haiku

# Generation Parameters
LLM_MAX_TOKENS=1000          # Maximum tokens to generate (default: 1000)
LLM_TEMPERATURE=0.1          # Creativity level 0.0-2.0 (default: 0.1)

# Custom API Endpoints (for custom deployments)
LLM_ANTHROPIC_ENDPOINT=https://api.anthropic.com/v1/messages
LLM_OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions
LLM_OPENROUTER_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
```

### 2. Cloudflare Workers Configuration

#### Secrets (sensitive data)
```bash
# Set using wrangler CLI
wrangler secret put LLM_CREDENTIALS
# Enter: anthropic:sk-ant-api03-xxxxx
```

#### Variables (public configuration)
Add to your `wrangler.toml`:
```toml
[vars]
LLM_MODEL = "claude-3-haiku-20240307"
LLM_MAX_TOKENS = "1000"
LLM_TEMPERATURE = "0.1"
LLM_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages"
LLM_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"
LLM_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
```

### 3. Dynamic Configuration (KV Store)

Configuration can be updated at runtime and stored in Cloudflare KV:

```javascript
// Example: Update model dynamically
await config.setValue('llm.model', 'claude-3-sonnet-20240229')
await config.setValue('llm.temperature', 0.2)
```

## Provider Selection Logic

The bot determines which provider to use based on the `LLM_CREDENTIALS` format:

1. **Credential Parsing**: Extract provider from credentials string
2. **Validation**: Verify provider is supported and credentials are valid
3. **Model Mapping**: Set appropriate default model if not specified
4. **Endpoint Resolution**: Use custom endpoint if configured, otherwise use default

```javascript
// Credential format examples:
"anthropic:sk-ant-api03-xxxxx" → provider: "anthropic"
"openai:sk-xxxxx"              → provider: "openai"  
"openrouter:sk-or-xxxxx"       → provider: "openrouter"
```

## Model Recommendations

### For Production (Balanced Performance)
- **Anthropic**: `claude-3-haiku-20240307` (fast, cost-effective)
- **OpenAI**: `gpt-3.5-turbo` (reliable, well-tested)
- **OpenRouter**: `anthropic/claude-3-haiku` (same as Anthropic)

### For Quality (Higher Cost)
- **Anthropic**: `claude-3-sonnet-20240229` (better reasoning)
- **OpenAI**: `gpt-4-turbo` (highest quality)
- **OpenRouter**: `openai/gpt-4-turbo` (access to latest models)

### For Development (Fastest)
- **Anthropic**: `claude-3-haiku-20240307`
- **OpenAI**: `gpt-3.5-turbo`
- **OpenRouter**: `anthropic/claude-3-haiku`

## Performance Parameters

### Max Tokens
- **Recommended**: `1000` tokens
- **Range**: `100-4000` tokens
- **Impact**: Higher values allow longer responses but increase cost and latency

### Temperature
- **Recommended**: `0.1` (deterministic)
- **Range**: `0.0-2.0`
- **Impact**: 
  - `0.0`: Completely deterministic
  - `0.1-0.3`: Consistent with slight variation
  - `0.7-1.0`: Creative and varied
  - `1.5-2.0`: Highly creative/random

## Health Monitoring

The bot includes comprehensive health monitoring for all LLM providers:

### Health Check Features
- **Automatic Monitoring**: Periodic health checks with caching
- **Response Time Tracking**: Monitor API response times
- **Error Detection**: Identify and log API errors
- **Provider Selection**: Automatically use the fastest healthy provider

### Health Check Commands
```bash
# Check provider health via Discord
/status health

# View detailed health information
/status stats timeframe:1h
```

### Health Check API
```javascript
import { quickHealthCheck, createHealthCheck } from './src/llm/health-check.js'

// Quick health check for all providers
const results = await quickHealthCheck(config)

// Advanced health monitoring
const healthCheck = createHealthCheck(config)
const bestProvider = await healthCheck.getBestProvider()
```

## Error Handling

### Common Error Types
1. **Configuration Errors**: Missing or invalid credentials
2. **API Errors**: Rate limits, authentication failures
3. **Network Errors**: Timeouts, connection failures
4. **Content Errors**: Invalid responses, parsing failures

### Error Recovery
- **Graceful Degradation**: Falls back to basic formatting if LLM fails
- **Retry Logic**: Automatic retries for transient failures
- **User Feedback**: Clear error messages for users

## Security Best Practices

### API Key Management
- ✅ Store API keys in Cloudflare secrets (not environment variables)
- ✅ Use different API keys for development/staging/production
- ✅ Rotate API keys regularly
- ✅ Monitor API usage for unusual activity

### Request Security
- ✅ Validate all inputs before sending to LLM
- ✅ Sanitize responses before displaying to users
- ✅ Implement rate limiting to prevent abuse
- ✅ Log all LLM interactions for debugging

## Cost Optimization

### Token Usage
- **Prompt Optimization**: Bot uses highly optimized prompts (~200 tokens)
- **Response Limits**: Configure appropriate `maxTokens` values
- **Context Management**: Limited to 3 most recent status updates

### Provider Selection
- **Anthropic Claude Haiku**: Most cost-effective for simple tasks
- **OpenAI GPT-3.5**: Good balance of cost and quality
- **OpenRouter**: Access to multiple models with competitive pricing

### Monitoring
- Track token usage via `/status stats` command
- Monitor costs through provider dashboards
- Set up billing alerts for usage thresholds

## Troubleshooting

### Configuration Issues
```bash
# Check configuration is loaded correctly
/status health

# Verify environment variables
echo $LLM_CREDENTIALS | cut -d: -f1  # Should show provider name
```

### Common Problems

#### "Invalid LLM provider" Error
- **Cause**: Unsupported provider in `LLM_CREDENTIALS`
- **Solution**: Use `anthropic`, `openai`, or `openrouter`

#### "API key not configured" Error
- **Cause**: Missing or invalid `LLM_CREDENTIALS`
- **Solution**: Set valid credentials: `provider:api_key`

#### "LLM API timeout" Error
- **Cause**: Network issues or provider outage
- **Solution**: Check provider status, try different provider

#### "Rate limit exceeded" Error
- **Cause**: Too many requests to LLM provider
- **Solution**: Wait and retry, consider upgrading API plan

### Debug Mode
Enable debug logging in development:
```bash
# In wrangler.toml [vars]
ENVIRONMENT = "development"
```

## Advanced Configuration

### Custom Endpoints
For enterprise or custom deployments:
```bash
# Azure OpenAI
LLM_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-05-15

# Custom Anthropic proxy
LLM_ANTHROPIC_ENDPOINT=https://your-proxy.company.com/v1/messages

# Self-hosted OpenRouter
LLM_OPENROUTER_ENDPOINT=https://your-router.company.com/api/v1/chat/completions
```

### Multiple Providers
To use different providers for different environments:
```bash
# Development
LLM_CREDENTIALS=anthropic:sk-ant-dev-xxxxx

# Staging  
LLM_CREDENTIALS=openai:sk-staging-xxxxx

# Production
LLM_CREDENTIALS=openrouter:sk-or-prod-xxxxx
```

### Provider Failover
Currently, the bot uses a single provider. For automatic failover:
1. Configure multiple API keys as separate secrets
2. Use health checks to determine best provider
3. Implement retry logic with provider switching

See [GitHub Issue #XXX](https://github.com/rmrfslashbin/discord-status-bot/issues/XXX) for planned failover support.

## Configuration Validation

The bot validates all LLM configuration on startup:

### Required Validations
- ✅ Provider is supported (`anthropic`, `openai`, `openrouter`)
- ✅ API key format is valid for provider
- ✅ Numeric values are within valid ranges
- ✅ Endpoints are valid URLs

### Optional Validations
- ⚠️ API key has sufficient permissions (checked on first use)
- ⚠️ Model is available for provider (falls back to default)
- ⚠️ Custom endpoints are reachable (falls back to default)

## Configuration Examples

### Minimal Configuration
```bash
# .env or wrangler secret
LLM_CREDENTIALS=anthropic:sk-ant-api03-xxxxx
```

### Full Configuration
```toml
# wrangler.toml
[vars]
LLM_MODEL = "claude-3-sonnet-20240229"
LLM_MAX_TOKENS = "2000"
LLM_TEMPERATURE = "0.2"
LLM_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages"
LLM_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"
LLM_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
```

### Multi-Environment Setup
```bash
# Development
wrangler secret put LLM_CREDENTIALS --env dev
# Enter: anthropic:sk-ant-dev-xxxxx

# Production  
wrangler secret put LLM_CREDENTIALS --env production
# Enter: openai:sk-prod-xxxxx
```

## Getting Started

1. **Choose Provider**: Select Anthropic, OpenAI, or OpenRouter
2. **Get API Key**: Register and obtain API credentials
3. **Set Credentials**: Configure `LLM_CREDENTIALS` secret
4. **Test Configuration**: Run `/status health` command
5. **Optimize Settings**: Adjust model, tokens, and temperature as needed

For additional support, see the [main README](../README.md) or [CONTRIBUTING](../CONTRIBUTING.md) guide.