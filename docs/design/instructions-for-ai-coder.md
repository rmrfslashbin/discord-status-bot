# Discord Status Dashboard Implementation Instructions

## Project Overview

This document provides instructions for implementing an AI-powered Discord status dashboard. The system allows users to send natural language descriptions of their current status to a Discord bot, which processes these descriptions using an LLM (Large Language Model) and displays the results as a formatted status dashboard in a Discord channel.

## Key Requirements

1. **User Input**: Users send status updates via Discord direct messages or slash commands.
2. **AI Processing**: Status text is analyzed by an LLM (Anthropic, OpenAI, or OpenRouter).
3. **Status Display**: A new message is posted for each status update, creating a timeline. Interactive components are included.
4. **Persistence**: User history, profiles, templates, activities, and logs are stored in Cloudflare KV.
5. **Configuration**: All sensitive information and settings use environment variables (secrets) and `wrangler.toml` vars.

## Implementation Goals

Create a Cloudflare Worker that:
1. Handles incoming Discord webhook events and interactions (slash commands, components).
2. Connects to an LLM API to process status text, considering previous context.
3. Formats dynamic, themed Discord embeds with interactive components.
4. Posts new status messages to a designated channel.
5. Manages user profiles, templates, custom emojis, activities, and interaction logs via KV storage.
6. Provides utility commands for health checks and data purging.
7. Maintains proper configuration and state using secrets and environment variables.

## Configuration Requirements

All sensitive and configurable information must be stored in environment variables or KV storage:
- Discord Bot Token
- Discord Application ID
- Discord Public Key
- LLM API Keys
- Model selection
- API endpoints
- Channel IDs

Do not hard-code any of these values in the source code.

## Project Structure

Follow the modular structure outlined in the Refactored Cloudflare Worker Implementation. The code should be organized into:
- Core worker logic
- Configuration management
- Discord API handlers
- LLM service integrations
- Message formatting
- Storage utilities

## Deployment Process

The application should be deployable as a Cloudflare Worker using Wrangler. Follow the deployment guide in the documentation.

## Testing Approach

Implement a testing strategy that includes:
1. Testing the LLM integration with sample inputs
2. Testing Discord API interactions
3. End-to-end testing with real Discord accounts

## Security Considerations

Ensure the implementation includes:
1. Proper Discord request verification
2. Secure storage of API keys and tokens
3. Input validation for all user content
4. Error handling and logging

## Additional Documentation

Refer to the following resources for detailed implementation guidance:
1. Discord Bot Flow - System architecture diagram
2. AI Prompt Design - LLM prompt engineering and JSON schema
3. Configuration Best Practices - Environment variable and KV storage patterns
4. Example Status Outputs - Sample status scenarios and expected outputs

## Support Resources

When implementing this project, use these references:
- Discord API Documentation: https://discord.com/developers/docs/intro
- Cloudflare Workers Documentation: https://developers.cloudflare.com/workers/
- Anthropic API Documentation: https://docs.anthropic.com/claude/reference/getting-started-with-the-api
- OpenAI API Documentation: https://platform.openai.com/docs/api-reference

## Deliverables

The final implementation should include:
1. Complete source code organized according to the project structure
2. Wrangler configuration file
3. Deployment instructions
4. Testing documentation
