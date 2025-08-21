# Contributing to Discord Status Bot

Thank you for your interest in contributing to the Discord Status Bot! This guide will help you get started with development and understand our contribution process.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- Node.js 18+ and npm (or pnpm recommended)
- Cloudflare account with Workers access
- Discord Developer Application
- LLM API key (Anthropic/OpenAI/OpenRouter)

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-username/discord-status-bot.git
   cd discord-status-bot
   npm install  # or pnpm install
   ```

2. **Configure environment:**
   ```bash
   # Copy example configuration
   cp .env.example .dev.vars
   
   # Edit .dev.vars with your actual values
   # See .env.example for detailed configuration instructions
   ```

3. **Set up Cloudflare KV:**
   ```bash
   # Create KV namespace for development
   wrangler kv:namespace create "STATUS_BOT_STORAGE" --preview
   
   # Update wrangler.toml with the namespace IDs
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Register Discord commands:**
   ```bash
   # Use the Discord API to register slash commands
   # See .env.example for curl command examples
   npm run register:commands  # if available
   ```

### Project Structure

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
│   ├── stats.js        # Statistics command
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
    └── logger.js        # Structured logging
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes following our code standards**

3. **Test your changes:**
   ```bash
   npm run test
   npm run lint
   npm run format:check
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

We follow [Conventional Commits](https://conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Standards

### JavaScript Style

- **ES6+ modules** (import/export)
- **Async/await** for asynchronous code
- **Const by default**, let when needed
- **No semicolons** (enforced by Prettier)
- **Single quotes** for strings
- **Destructuring** where appropriate

### Code Quality Tools

```bash
# Linting
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues

# Formatting
npm run format         # Format all files
npm run format:check   # Check formatting

# All validations
npm run validate       # Runs lint + format:check
npm run precommit      # Runs validate + tests
```

### Error Handling

- Always validate inputs at module boundaries
- Use structured error responses with trace IDs
- Log errors with sufficient context for debugging
- Implement graceful degradation for LLM failures

### Security Guidelines

- **NEVER commit API keys or secrets**
- Always validate Discord interaction signatures
- Sanitize user inputs before processing
- Use structured logging (avoid logging sensitive data)
- Implement rate limiting considerations

### Documentation

- Add JSDoc comments for public functions
- Update README.md for significant changes
- Include inline comments for complex logic
- Document environment variables in .env.example

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test src/utils/logger.test.js
```

### Writing Tests

- Use Vitest testing framework
- Mock external dependencies (Discord API, LLM APIs, KV storage)
- Test both success and error scenarios
- Include integration tests for key workflows

Example test structure:
```javascript
import { describe, it, expect, vi } from 'vitest'
import { functionToTest } from '../src/module.js'

describe('functionToTest', () => {
  it('should handle valid input correctly', () => {
    const result = functionToTest('valid input')
    expect(result).toEqual(expectedOutput)
  })
  
  it('should handle errors gracefully', () => {
    expect(() => functionToTest(null)).toThrow()
  })
})
```

## Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date:**
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Run all checks:**
   ```bash
   npm run precommit
   ```

3. **Push your branch:**
   ```bash
   git push origin feature/your-feature
   ```

4. **Create a Pull Request:**
   - Use a clear, descriptive title
   - Reference any related issues
   - Include screenshots for UI changes
   - Add test coverage information

### PR Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] No new security vulnerabilities
- [ ] Backwards compatibility maintained

### Code Review Process

- All PRs require at least one approval
- Address review feedback promptly
- Keep PRs focused and reasonably sized
- Be responsive to questions and suggestions

## Release Process

### Versioning

We use semantic versioning (SemVer):
- `MAJOR.MINOR.PATCH` (e.g., 2025.1.21)
- Date-based versioning for regular releases
- Patch versions for hotfixes

### Deployment

```bash
# Development
npm run deploy:dev

# Staging
npm run deploy:staging

# Production
npm run deploy:prod
```

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Version number bumped
- [ ] CHANGELOG.md updated
- [ ] Discord commands re-registered if needed
- [ ] Deployment smoke tested

## Common Development Tasks

### Adding a New Discord Command

1. **Define command** in `src/discord/commands.js`
2. **Add handler** in appropriate module (create new if needed)
3. **Route command** in `src/discord/interactions.js`
4. **Test locally** with `npm run dev`
5. **Register command** with Discord API

### Adding a New LLM Provider

1. **Create provider module** in `src/llm/[provider].js`
2. **Implement standard interface** (see existing providers)
3. **Add to processor router** in `src/llm/processor.js`
4. **Update configuration** in `src/config.js`
5. **Document** in README.md and .env.example

### Debugging

```bash
# View real-time logs
npm run tail

# Local development with hot reload
npm run dev

# Test specific endpoints
curl http://localhost:8787/api/status
```

## Getting Help

- **Documentation:** Check README.md and CLAUDE.md
- **Issues:** Search existing GitHub issues first
- **Discussions:** Use GitHub Discussions for questions
- **Discord:** Join our development Discord server [link]

## Contributing Guidelines

### What We Welcome

- Bug fixes and performance improvements
- New features that align with project goals
- Documentation improvements
- Test coverage improvements
- Security enhancements

### What We Don't Accept

- Breaking changes without discussion
- Features that significantly increase complexity
- Code that doesn't follow our standards
- Changes without appropriate tests
- Security vulnerabilities

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

Thank you for contributing to Discord Status Bot! 🤖✨