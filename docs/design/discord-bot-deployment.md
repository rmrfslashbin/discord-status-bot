# Discord Bot Setup and Deployment Guide

This guide walks through setting up and deploying the Status Dashboard Bot using Discord's API and Cloudflare Workers.

## Discord Bot Setup

### 1. Create a Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Status Dashboard")
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under "Privileged Gateway Intents," enable:
   - Server Members Intent
   - Message Content Intent
5. Save changes

### 2. Bot Permissions Setup
1. Go to the "OAuth2" tab
2. In the "URL Generator" section, select the following scopes:
   - `bot`
   - `applications.commands`
3. Select the following bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Manage Messages
   - Embed Links
   - Read Message History
   - Add Reactions
4. Copy the generated URL and paste it in your browser to add the bot to your server

### 3. Bot Token and Keys
1. In the "Bot" tab, click "Reset Token" to generate a new token
2. Save this token securely - you'll need it for the Cloudflare Worker
3. In the "General Information" tab, note down:
   - Application ID
   - Public Key

### 4. Register Slash Commands
Use the provided `register.js` script to register all necessary commands (`/status`, `/template`, `/profile`, `/emoji`, `/health`, `/purge`).
1.  Install `dotenv`: `npm install dotenv --save-dev`
2.  Create `.dev.vars` file with `DISCORD_APPLICATION_ID` and `DISCORD_BOT_TOKEN` (add to `.gitignore`).
3.  Run: `node register.js`

## Cloudflare Worker Deployment

### 1. Setup Cloudflare Workers Account
1. Sign up for a [Cloudflare Workers](https://workers.cloudflare.com/) account
2. Install Wrangler CLI: `npm install -g wrangler`
3. Authenticate with `wrangler login`

### 2. Create Worker Project
1. Create a new directory for your project
2. Initialize with: `wrangler init status-bot`
3. Choose the "Workers Service" template when prompted

### 3. Configure Worker Settings
Create a `wrangler.toml` file in your project directory:

```toml
name = "status-dashboard-bot"
main = "src/index.js"
compatibility_date = "2023-09-01"

[vars]
# These are example environment variables
# You'll set the actual values in the Cloudflare dashboard or via wrangler secrets
EXAMPLE_VAR = "example_value"

# Optionally configure KV namespace for storing message IDs
[[kv_namespaces]]
binding = "STATUS_BOT_STORAGE"
id = "your-kv-namespace-id" # You'll get this when you create a KV namespace
```

### 4. Add Environment Secrets
Use Wrangler to add your secret environment variables:

```bash
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_APPLICATION_ID
# Format: provider:key (e.g., anthropic:sk-...)
wrangler secret put LLM_CREDENTIALS
```
**Note:** `DISCORD_PUBLIC_KEY` and `STATUS_CHANNEL_ID` should be set as `vars` in `wrangler.toml`, not secrets. `STATUS_MESSAGE_ID` is no longer used as new messages are posted.

### 5. Deploy the Worker
Copy the Cloudflare Worker implementation into `src/index.js` and deploy:

```bash
wrangler publish
```

### 6. Configure Discord Webhook URL
1. Note the URL of your deployed worker (e.g., `https://status-dashboard-bot.your-username.workers.dev`)
2. Set up Discord webhook to point to: `https://status-dashboard-bot.your-username.workers.dev/webhook`
3. Configure your application's Interactions Endpoint URL in the Discord Developer Portal to: `https://status-dashboard-bot.your-username.workers.dev/interactions`

## LLM API Setup

### 1. Anthropic API (Claude)
1. Sign up for an [Anthropic API](https://www.anthropic.com/product) account
2. Generate an API key from your account dashboard
3. Use this key as the `LLM_API_KEY` in your worker configuration
4. Ensure your worker is configured to use the 'anthropic' service

### 2. OpenAI API (Alternative)
1. Create an [OpenAI](https://platform.openai.com/) account
2. Generate an API key from your account dashboard
3. Use this key as the `LLM_API_KEY` in your worker configuration
4. Change the worker configuration to use the 'openai' service

### 3. OpenRouter (Multi-model Option)
1. Sign up for an [OpenRouter](https://openrouter.ai/) account
2. Generate an API key
3. Use this key as the `LLM_API_KEY` in your worker configuration
4. Change the worker configuration to use the 'openrouter' service
5. Optionally modify the model selection in the worker code

## Usage Guide

### Direct Message Method
Users can update their status by sending a direct message to the bot with their status narrative:

```
Just finished a long work session and feeling drained. Could use some chill gaming time but nothing competitive. Available for the next 3 hours or so.
```

### Slash Command Method
Users can update their status using the `/status update` command:

```
/status update Just finished a long work session and feeling drained. Could use some chill gaming time but nothing competitive.
```

### Status Dashboard Management
- The status message is pinned in the designated channel
- Users can request an update by clicking the "Request Update" button
- The bot will maintain the same message ID for all updates, keeping the channel clean

## Troubleshooting

### Common Issues
1. **Discord API Rate Limits**: Implement exponential backoff for retry logic
2. **LLM Processing Errors**: Check API keys and response formats
3. **Message ID Not Found**: Ensure the STATUS_MESSAGE_ID is correctly set or allow for new message creation

### Monitoring
1. Set up Cloudflare Worker analytics to monitor usage and errors
2. Implement logging for critical operations
3. Create a status command for bot health checks

## Security Considerations

### API Key Protection
- Never expose API keys in client-side code
- Rotate API keys regularly
- Use least-privilege permissions for bot tokens

### Request Verification
- Implement proper Discord interaction verification
- Add IP-based restrictions when possible
- Validate all input before processing

### Data Privacy
- Store minimal user data
- Be transparent about what data is processed by LLMs
- Provide option to opt out of status tracking
