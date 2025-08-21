# Discord Bot Commands Documentation

## Overview
This document details all available Discord slash commands for the status bot and how to manage them.

## Command Structure

The bot uses a single main command `/status` with multiple subcommands and subcommand groups for organization.

### Main Command: `/status`
**Description**: Manage your status dashboard, profile, and emojis

## Available Commands

### 📝 Status Management

#### `/status update`
Update your status using free-form text.

**Parameters:**
- `text` (required): Describe your current status, mood, and availability

**Example:**
```
/status update text:"Working on the quarterly report, feeling productive but need coffee ☕"
```

### 👤 Profile Management

#### `/status profile view`
View your current profile settings including timezone, theme, and visibility preferences.

#### `/status profile timezone`
Set your preferred timezone for accurate time display.

**Parameters:**
- `value` (required): IANA timezone identifier (e.g., "America/New_York", "Europe/London")

**Example:**
```
/status profile timezone value:"America/Los_Angeles"
```

#### `/status profile theme`
Set your default status theme for consistent styling.

**Parameters:**
- `value` (required): Theme name
  - `default`: Standard theme
  - `work`: Professional/office theme
  - `gaming`: Gaming theme
  - `social`: Social/casual theme
  - `rest`: Relaxation theme
  - `creative`: Creative work theme
  - `learning`: Study/education theme

#### `/status profile visibility`
Set your profile visibility (reserved for future use).

**Parameters:**
- `value` (required): `public` or `private`

### 😊 Emoji Customization

#### `/status emoji list`
Display all your custom emoji mappings for status indicators.

#### `/status emoji set`
Customize the emoji used for a specific status indicator.

**Parameters:**
- `state` (required): Status indicator to customize (e.g., "energy", "mood", "focus")
- `emoji` (required): Emoji to use (standard Unicode emojis recommended)

**Example:**
```
/status emoji set state:"energy" emoji:"⚡"
/status emoji set state:"mood" emoji:"😊"
```

#### `/status emoji reset`
Reset a custom emoji back to the default.

**Parameters:**
- `state` (required): Status indicator to reset

### 🛠️ Utility Commands

#### `/status health`
Check the bot's operational status, version, and LLM provider availability.

**Returns:**
- Bot version
- Uptime
- LLM provider status (Anthropic, OpenAI, OpenRouter)
- KV storage status
- Response time metrics

#### `/status stats`
View usage statistics and metrics for the bot.

**Parameters:**
- `timeframe` (optional): Time range for statistics
  - `1h`: Last hour
  - `24h`: Last 24 hours
  - `7d`: Last 7 days
  - `30d`: Last 30 days
  - `all`: All time

**Returns:**
- Total status updates
- Active users count
- Average response time
- Most used features
- Peak usage times

#### `/status info`
Display information about the bot and available commands.

**Returns:**
- Bot description
- Available commands list
- Support links
- Version information

#### `/status purge`
⚠️ **DANGER**: Permanently delete all your stored data including history, profile, and settings.

**Parameters:**
- `confirm` (required): Must be set to `true` to confirm deletion

**Warning**: This action is IRREVERSIBLE. All your data will be permanently deleted.

## Command Registration

### Prerequisites
1. Discord Bot Token (`DISCORD_BOT_TOKEN`)
2. Discord Application ID (`DISCORD_APPLICATION_ID`)
3. Node.js 18+ installed

### Setup Environment Variables

Create a `.dev.vars` file in the project root:
```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_APPLICATION_ID=your_application_id_here
```

### Register Commands

#### Quick Registration
```bash
# Verify and register all commands
npm run commands
```

#### Step-by-Step
```bash
# 1. Verify command definitions
npm run verify:commands

# 2. Register with Discord API
npm run register:commands
```

### Verify Registration

After registration, commands may take up to an hour to propagate globally. To verify:

1. Check Discord server - type `/` to see available commands
2. Run the health check: `/status health`
3. View command list: `/status info`

## Command Handler Implementation

Commands are handled in the following files:

| Command | Handler File | Function |
|---------|-------------|----------|
| `/status update` | `src/api/status.js` | `processStatusUpdate()` |
| `/status health` | `src/discord/utility-commands.js` | `handleHealthCommand()` |
| `/status stats` | `src/discord/stats.js` | `handleStatsCommand()` |
| `/status profile/*` | `src/discord/profile.js` | `handleProfileCommand()` |
| `/status emoji/*` | `src/discord/emoji.js` | `handleEmojiCommand()` |
| `/status purge` | `src/discord/utility-commands.js` | `handlePurgeCommand()` |
| `/status info` | `src/discord/utility-commands.js` | `handleInfoCommand()` |

## Adding New Commands

### 1. Define Command Structure
Edit `src/discord/commands.js`:
```javascript
{
  name: 'newcommand',
  description: 'Description of the new command',
  type: 1, // SUB_COMMAND
  options: [
    {
      name: 'parameter',
      description: 'Parameter description',
      type: 3, // STRING
      required: true
    }
  ]
}
```

### 2. Implement Handler
Create or update handler in appropriate file:
```javascript
export async function handleNewCommand(interaction, ctx) {
  // Extract parameters
  const parameter = interaction.data.options[0].options.find(
    opt => opt.name === 'parameter'
  )?.value
  
  // Process command
  // Return Discord response
  return {
    type: 4,
    data: {
      content: 'Command executed successfully',
      flags: 64 // Ephemeral
    }
  }
}
```

### 3. Connect Handler
Update `src/discord/interactions.js` to route the command:
```javascript
case 'newcommand':
  return await handleNewCommand(interaction, ctx)
```

### 4. Register with Discord
```bash
npm run commands
```

## Command Types Reference

| Type | Name | Description |
|------|------|-------------|
| 1 | SUB_COMMAND | A subcommand |
| 2 | SUB_COMMAND_GROUP | A subcommand group |
| 3 | STRING | String input |
| 4 | INTEGER | Integer input |
| 5 | BOOLEAN | True/false |
| 6 | USER | User mention |
| 7 | CHANNEL | Channel mention |
| 8 | ROLE | Role mention |
| 9 | MENTIONABLE | User or role |
| 10 | NUMBER | Decimal number |
| 11 | ATTACHMENT | File upload |

## Testing Commands

### Local Testing
1. Set up development environment:
   ```bash
   npm run dev
   ```

2. Use Discord test server to interact with the bot

3. Monitor logs:
   ```bash
   npm run tail
   ```

### Production Testing
1. Deploy to production:
   ```bash
   npm run deploy:prod
   ```

2. Test each command in production Discord server

3. Monitor errors and performance

## Troubleshooting

### Commands Not Appearing
- Wait up to 1 hour for global propagation
- Verify bot has necessary permissions
- Check bot is invited with `applications.commands` scope
- Run `npm run verify:commands` to check definitions

### Registration Errors
- Verify environment variables are set correctly
- Check bot token is valid
- Ensure application ID matches your bot
- Review Discord API error messages in console

### Handler Errors
- Check logs with `npm run tail`
- Verify handler is properly connected in `interactions.js`
- Test with different parameter values
- Check for validation errors

## Best Practices

1. **Always defer long operations** - Use deferred responses for operations > 3 seconds
2. **Validate input** - Check parameters before processing
3. **Use ephemeral messages** - For sensitive or user-specific information
4. **Provide feedback** - Always respond to user interactions
5. **Handle errors gracefully** - Return user-friendly error messages
6. **Document changes** - Update this file when adding/modifying commands
7. **Test thoroughly** - Test all parameter combinations
8. **Monitor usage** - Track command usage with `/status stats`