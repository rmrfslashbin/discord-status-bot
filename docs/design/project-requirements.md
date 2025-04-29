# AI-Powered Discord Status Dashboard: Technical Requirements

## Project Overview

This document outlines the technical requirements for an AI-powered Discord status dashboard system. The system allows users to provide natural language descriptions of their status, processes these descriptions using an LLM, and displays the results as a formatted status dashboard in Discord.

## Core Functionality

1. **User Input Collection**
   - Discord bot receives direct messages from users
   - Bot responds to slash commands in designated channels
   - Input is natural language descriptions of current status/mood/availability

2. **AI Processing**
   - Input text is submitted to an LLM API (Anthropic, OpenAI, or OpenRouter)
   - LLM parses the text and returns structured JSON according to a defined schema
   - The system validates and processes the JSON output

3. **Status Display**
   - System formats the JSON into a dynamic, themed Discord embed.
   - A new message is posted for each update, creating a timeline.
   - Status displays include dynamic metrics, highlights, personal states, and context.

4. **Interactive Elements**
   - Buttons ("Check In", "Show Details", "Join Activity") on status messages.
   - Select Menu ("Quick React") on status messages.
   - Component expiration handling.

## Technical Architecture

### Discord Bot Components
- Application with slash command support
- Message listener for direct message processing
- Webhook handler for notifications
- Message editor for updating status messages

### Serverless Processing (Cloudflare Worker)
- Webhook receiver for Discord events
- API client for LLM services
- Message formatter for Discord embeds
- Storage solution for message IDs and user data

### LLM Integration
- Prompt engineering for consistent JSON output
- Error handling for malformed responses
- Fallback mechanisms for service disruptions

## JSON Schema

The LLM generates a response conforming to this dynamic schema:

```json
{
  "overall_status": "A brief phrase capturing their current overall status (e.g., 'Focusing on Project X', 'Relaxing after work', 'Feeling blocked')",
  "mood_emoji": "A single emoji that best represents their current mood (e.g., '😊', '☕', '🚧', '🎮')",
  "visual_theme": "work | gaming | social | rest | creative | learning | default",
  "accent_color": "A suggested hex color code (e.g., '#4287f5') or color name ('blue') that fits the mood/theme",
  "metrics": {
    {
      "name": "Name of the metric (e.g., 'Energy', 'Focus', 'Project Progress', 'Mood')",
      "value": "Textual or numeric value (e.g., 'Low', 'High', '75%', 'Good')",
      "value_rating": "Numeric rating 1-5 (optional, provide if easily inferred)",
      "trend": "improved | worsened | unchanged | new",
      "icon": "A single emoji representing this metric (e.g., '⚡', '🧠', '📊', '😊')"
    }
  ],
  "highlights": [
    {
      "type": "activity | event | state | need | achievement | blocker",
      "description": "Description of the highlight (e.g., 'Working on API integration', 'Attended team meeting', 'Feeling tired', 'Need coffee', 'Fixed critical bug', 'Waiting for review')",
      "timeframe": "past | current | future | ongoing",
      "is_new": "true if this highlight is primarily from the current update, false if mainly carried over/updated from previous context"
    }
  ],
  "persistent_context": [
    {
      "description": "Description of a relevant state or context carried over from previous updates (e.g., 'Ongoing project: Dashboard UI', 'Recovering from cold')",
      "from_previous": true,
      "source_timestamp": "Timestamp of the status where this context originated (e.g., '2025-04-28T15:00:00Z')"
    }
  ],
  "personal_states": [
    {
      "name": "Name of the personal state (e.g., Hunger, Arousal, Tiredness)",
      "emoji": "The corresponding emoji (e.g., 🍽️, 😈, 😴)",
      "level": "Intensity level 1-5",
      "time_since_last": "Human-readable time elapsed (e.g., '4h ago', '2d ago', 'just now')",
      "trend": "increasing | decreasing | stable | new"
    }
  ],
  "narrative_summary": "A concise 1-2 sentence natural language summary combining the most important current information and relevant persistent context.",
  "errors": [
    "A list of strings describing any issues encountered during analysis (e.g., 'Ambiguous statement about availability', 'Could not determine project progress'). Leave empty ([]) if no issues."
  ]
}
```

## Discord Message Format

The status dashboard should be formatted as follows:
- Themed title with prefix emoji and accent bar.
- User mention, overall status, and relative timestamp.
- Themed embed color.
- Sections for:
  - Relevant metrics with trend indicators and progress bars.
  - Highlights with type emojis and new/updated indicators.
  - Personal states with level indicators and time since last.
  - Persistent context carried over from previous updates.
  - Narrative summary.
  - Analysis errors (if any).
- Footer indicating theme and timestamp.
- Interactive components (buttons, select menu).

## Implementation Steps (High Level)

1. **Discord Setup:** Create App/Bot, configure permissions/scopes, get credentials.
2. **Cloudflare Setup:** Create Worker, KV namespace, configure `wrangler.toml`, set secrets.
3. **Code Implementation:** Develop worker logic following modular structure (config, interactions, commands, components, API, LLM, storage, embeds, utils).
4. **Command Registration:** Use `register.js` to register slash commands.
5. **Deployment:** Deploy worker using Wrangler, configure Discord Interaction Endpoint URL.
6. **Testing:** Perform unit, integration, and end-to-end testing.
7. **Documentation:** Update README and other relevant documents.

## Configuration Parameters

The system requires these configuration values (managed via secrets and `wrangler.toml`):
- `DISCORD_BOT_TOKEN` (Secret)
- `DISCORD_APPLICATION_ID` (Secret)
- `LLM_CREDENTIALS` (Secret - format: `provider:key`)
- `DISCORD_PUBLIC_KEY` (Var)
- `STATUS_CHANNEL_ID` (Var)
- `DISCORD_API_VERSION` (Var - e.g., `v10`)
- `LLM_SERVICE` (Var - Optional, defaults based on `LLM_CREDENTIALS`)
- `LLM_MODEL` (Var - Optional, defaults based on service)
- `LLM_MAX_TOKENS` (Var - Optional, defaults to 1000)
- `LLM_TEMPERATURE` (Var - Optional, defaults to 0.1)
- `ENVIRONMENT` (Var - e.g., `development`, `production`)

## Error Handling

The system should gracefully handle:
- LLM service disruptions (fallback to default status).
- Malformed JSON responses (fallback to default status).
- Discord API rate limits (via `discordApiRequest` retries - *Note: Basic implementation, may need enhancement*).
- KV storage errors (log errors, potentially notify user).
- Invalid user inputs (provide feedback via ephemeral messages).
- Component interaction errors (log errors, attempt ephemeral followup).

## Security Considerations

- API keys should be stored securely as environment variables
- Input validation should be performed on all user content
- Discord interaction verification must be implemented
- Minimal user data should be stored
