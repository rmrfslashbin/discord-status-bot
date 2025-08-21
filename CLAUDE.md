# Discord Status Bot - Development Guide

## Project Overview
AI-powered Discord status bot running on Cloudflare Workers with support for multiple LLM providers (Anthropic, OpenAI, OpenRouter).

## Technology Stack
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Language**: JavaScript ES6+ (ES Modules)
- **Storage**: Cloudflare KV
- **Package Manager**: npm (pnpm recommended when available)
- **Testing**: Vitest
- **Linting**: ESLint
- **Formatting**: Prettier

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy         # Default environment
npm run deploy:dev     # Development environment  
npm run deploy:prod    # Production environment

# Monitor logs
npm run tail
```

### Code Quality
```bash
# Run linting
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues

# Format code
npm run format         # Format all files
npm run format:check   # Check formatting

# Run all validations
npm run validate       # Runs lint + format:check

# Pre-commit hook
npm run precommit      # Runs validate + tests
```

### Testing
```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

### Discord Commands
```bash
# Register slash commands with Discord
npm run register:commands
```

## Project Structure
```
src/
├── index.js              # Main entry point & router
├── config.js             # Configuration management
├── api/                  # API endpoints
│   └── status.js         # Status dashboard endpoint
├── discord/              # Discord-specific modules
│   ├── api.js           # Discord API client
│   ├── commands.js      # Command definitions
│   ├── interactions.js  # Interaction handlers
│   ├── embeds.js       # Message formatting
│   └── validators.js    # Input validation
├── llm/                  # AI/LLM integrations
│   ├── anthropic.js    # Claude API
│   ├── openai.js       # GPT API
│   ├── openrouter.js   # OpenRouter API
│   └── processor.js    # LLM processing logic
├── storage/              # Data persistence
│   ├── kv.js           # KV store operations
│   ├── profile.js      # User profiles
│   └── activity.js     # Activity tracking
└── utils/                # Utility functions
    ├── color.js         # Color utilities
    ├── time.js          # Time formatting
    └── component-expiration.js
```

## Key Design Patterns

### 1. Cloudflare Workers Constraints
- No Node.js runtime - use Web APIs only
- Request handling must complete within limits
- Use KV for persistence (eventual consistency)
- Environment variables via wrangler.toml

### 2. Discord Interaction Flow
```javascript
// All Discord interactions follow this pattern:
1. Receive interaction webhook
2. Validate signature (security)
3. Route to appropriate handler
4. Respond within 3 seconds (or defer)
5. Store state in KV if needed
```

### 3. Error Handling
- Always validate Discord signatures
- Use structured error responses
- Log errors with context
- Graceful degradation for LLM failures

### 4. Testing Approach
- Mock Cloudflare KV operations
- Mock fetch for external APIs
- Test Discord interaction handlers
- Validate command schemas

## Environment Configuration

### Required Secrets (in wrangler.toml or .dev.vars)
```
DISCORD_PUBLIC_KEY=     # For signature verification
DISCORD_APPLICATION_ID= # Your app ID
DISCORD_BOT_TOKEN=      # Bot authentication
ANTHROPIC_API_KEY=      # Claude API
OPENAI_API_KEY=         # GPT API
OPENROUTER_API_KEY=     # OpenRouter API
```

### KV Namespaces
- `DISCORD_BOT_KV`: Main storage namespace
- Configured in wrangler.toml

## Common Development Tasks

### Adding a New Discord Command
1. Define command in `src/discord/commands.js`
2. Add handler in `src/discord/interactions.js`
3. Register with Discord: `npm run register:commands`
4. Test in development: `npm run dev`

### Adding LLM Provider
1. Create provider module in `src/llm/`
2. Implement standard interface (see existing providers)
3. Add to processor.js router
4. Add API key to environment config

### Debugging
```bash
# View real-time logs
npm run tail

# Local development with hot reload
npm run dev

# Test specific endpoints
curl http://localhost:8787/api/status
```

## Code Standards

### JavaScript Style
- ES6+ modules (import/export)
- Async/await for asynchronous code
- Destructuring where appropriate
- Const by default, let when needed
- No semicolons (enforced by Prettier)
- Single quotes for strings

### Error Messages
- User-facing: Clear, actionable
- Developer logs: Include context
- API errors: Structured JSON

### Security
- NEVER commit API keys
- Always validate Discord signatures
- Sanitize user inputs
- Rate limit considerations

## Testing Guidelines

### Unit Tests
```javascript
// Test individual functions
import { describe, it, expect } from 'vitest'
import { formatDuration } from '../src/utils/time.js'

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(90)).toBe('1m 30s')
  })
})
```

### Integration Tests
```javascript
// Test API endpoints
it('handles Discord interactions', async () => {
  const response = await fetch('/interactions', {
    method: 'POST',
    headers: {
      'X-Signature-Ed25519': validSignature,
      'X-Signature-Timestamp': timestamp,
    },
    body: JSON.stringify(interaction),
  })
  expect(response.status).toBe(200)
})
```

## Deployment Checklist

1. ✅ Run tests: `npm run test`
2. ✅ Check linting: `npm run lint`
3. ✅ Verify formatting: `npm run format:check`
4. ✅ Update version in package.json
5. ✅ Deploy to dev first: `npm run deploy:dev`
6. ✅ Test in Discord dev server
7. ✅ Deploy to production: `npm run deploy:prod`

## Troubleshooting

### Common Issues

**Wrangler errors**: Ensure wrangler.toml is configured
**KV not working**: Check namespace bindings
**Discord signature fails**: Verify PUBLIC_KEY
**LLM timeout**: Implement proper deferrals
**Deploy fails**: Check account ID and API token

### Useful Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Discord API Docs](https://discord.com/developers/docs)
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/)

## Performance Optimization

### KV Best Practices
- Batch operations when possible
- Use appropriate TTLs
- Cache frequently accessed data
- Consider eventual consistency

### Response Times
- Defer long operations
- Stream responses when possible
- Optimize LLM prompts for speed
- Use webhook followups for slow ops

## Notes for AI Assistants

When working on this codebase:
1. Respect Cloudflare Workers constraints (no Node.js APIs)
2. Maintain consistent error handling patterns
3. Test Discord interactions thoroughly
4. Keep security as top priority
5. Follow existing code style (ESLint/Prettier)
6. Update tests when changing functionality
7. Use environment variables for all secrets
8. Document new features in README