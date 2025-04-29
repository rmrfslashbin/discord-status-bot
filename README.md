# Discord Status Dashboard Bot (Cloudflare Worker)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project implements a Discord bot running as a Cloudflare Worker that uses a Large Language Model (LLM) to analyze user status updates (provided via slash commands or Direct Messages) and display them in a dynamic, visually appealing dashboard format within a designated Discord channel. Each status update posts a new message, creating a timeline.

## Features

*   **Natural Language Status Updates:** Users describe their status in free-form text.
*   **LLM-Powered Analysis:** Leverages LLMs (configurable: Anthropic Claude, OpenAI GPT, OpenRouter) to parse status text and extract key metrics, highlights, personal states, and context.
*   **Context Retention:** Remembers relevant information from previous updates to provide a coherent status narrative over time.
*   **Dynamic Dashboard:** Displays status using themed Discord embeds, including:
    *   Overall status summary and mood emoji.
    *   Visual theme (work, gaming, social, rest, etc.) with corresponding colors and icons.
    *   Relevant metrics (e.g., Energy, Focus) with trend indicators and progress bars.
    *   Key highlights (activities, events, states, needs, achievements) with timeframe indicators.
    *   Personal state tracking (e.g., Hunger, Tiredness, Arousal) with intensity levels and time since last satisfaction.
    *   Persistent context carried over from previous updates.
    *   Concise narrative summary combining current and past relevant info.
    *   Error reporting if LLM analysis encounters issues.
*   **Timeline Updates:** Posts a new message for each update instead of editing a single one.
*   **Interactive Components:**
    *   Buttons: "Check In" (send DM), "Show Details" (ephemeral detailed view), "Join Activity" (appears contextually).
    *   Select Menu: "Quick React" for common social responses.
    *   Component Expiration: Interactions on older messages are disabled.
*   **User Profiles:**
    *   Stores user preferences (theme, timezone - *formatting TBD*, visibility - *future use*).
    *   Managed via `/profile` command (`view`, `theme`, `timezone`, `visibility`).
*   **Custom Emojis:**
    *   Allows users to override default emojis for specific states/metrics.
    *   Managed via `/emoji` command (`list`, `set`, `reset`).
*   **Status Templates:**
    *   Save, use, list, and delete reusable status update templates.
    *   Organize templates by category.
    *   Managed via `/template` command (`list`, `use`, `save`, `delete`, `export`\*, `import`\*). (\*Placeholders)
*   **Data Management:**
    *   `/purge confirm` command to allow users to delete all their stored data (history, profile, templates, activities, logs).
*   **Utility Commands:**
    *   `/health` command to display bot version and status.
*   **Configurable:** Configure LLM provider, model, Discord settings via environment variables and secrets.
*   **Serverless:** Runs entirely on the Cloudflare Workers platform using KV storage.

## Architecture

1.  **Cloudflare Worker (`src/index.js`):** Main entry point, initializes configuration, routes requests.
2.  **Configuration (`src/config.js`):** `Configuration` class loads settings from `wrangler.toml` vars, secrets, and optionally KV. Provides access to settings, KV binding, version, build ID.
3.  **Interaction Handling (`src/discord/interactions.js`):** Verifies requests (`src/discord/verify.js`), routes slash commands and component interactions to specific handlers. Manages deferred responses.
4.  **Command Handlers (`src/discord/*.js`):** Dedicated files for handling logic of specific commands (`template-commands.js`, `profile.js`, `emoji.js`, `utility-commands.js`).
5.  **Component Handler (`src/discord/components.js`):** Handles logic for button/select menu interactions, using expiration checks (`src/utils/component-expiration.js`).
6.  **Status API (`src/api/status.js`):** Core logic for processing `/status update` or template use: fetches context, loads profile, calls LLM, applies custom emojis, creates activity, stores results, formats message, posts to Discord.
7.  **LLM Processor (`src/llm/processor.js`):** Constructs context-aware prompts, calls the configured LLM API client (`src/llm/*.js`), parses and validates the dynamic JSON response. Includes context formatting and time utilities (`src/llm/context.js`).
8.  **Discord API Client (`src/discord/api.js`):** Generic helper (`discordApiRequest`) and specific functions (`createStatusMessage`, `editInteractionResponse`, `sendInteractionFollowup`, `sendDirectMessage`) for interacting with the Discord API.
9.  **Embed Formatter (`src/discord/embeds.js`):** Formats the dynamic LLM data into themed Discord embeds using helpers from `src/discord/themes.js`. Incorporates profile preferences and adds interactive components.
10. **Storage (`src/storage/*.js`):** Modules for interacting with Cloudflare KV:
    *   `kv.js`: Status history, interaction logs, template storage, user data purge.
    *   `profile.js`: User profile settings and custom emojis.
    *   `activity.js`: Activity creation and joining logic.
11. **Utilities (`src/utils/*.js`):** Helper functions for color conversion, component expiration, time formatting (placeholders).

## Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended) and npm
*   A [Cloudflare Account](https://dash.cloudflare.com/sign-up)
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
*   A [Discord Bot Application](https://discord.com/developers/applications)
*   An API Key for your chosen LLM provider (Anthropic, OpenAI, or OpenRouter)

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/rmrfslashbin/discord-status-bot.git
    cd discord-status-bot
    ```

2.  **Install Dependencies:**
    ```bash
    npm install # Installs dotenv for register.js script
    ```

3.  **Configure Discord Bot:**
    *   Follow steps in [`docs/design/discord-bot-deployment.md`](docs/design/discord-bot-deployment.md) to create the application, bot, get tokens/keys, and invite the bot with necessary scopes (`bot`, `applications.commands`) and permissions.
    *   **Required Permissions:** `View Channel`, `Send Messages`, `Embed Links`, `Read Message History`.

4.  **Get LLM API Key:**
    *   Sign up and get an API key from Anthropic, OpenAI, or OpenRouter.

5.  **Configure Cloudflare Worker:**
    *   **Log in to Wrangler:** `wrangler login`
    *   **Create KV Namespace:** This namespace stores all user data (history, profiles, templates, activities, logs).
        ```bash
        wrangler kv namespace create STATUS_BOT_STORAGE
        ```
    *   **Update `wrangler.toml`:** Replace placeholder `id` and `preview_id` for `STATUS_BOT_STORAGE` with the actual ID provided by the command above. Review and set non-sensitive `vars` like `DISCORD_PUBLIC_KEY`, `STATUS_CHANNEL_ID`, `LLM_MODEL`, etc., for your target environments (`[env.development]`, `[env.production]`).
    *   **Set Secrets:** Run these commands, pasting your stored values when prompted:
        ```bash
        wrangler secret put DISCORD_BOT_TOKEN
        wrangler secret put DISCORD_APPLICATION_ID
        # Set the LLM provider and API key as a single secret (Format: provider_name:api_key)
        wrangler secret put LLM_CREDENTIALS
        # --- Examples ---
        # Anthropic: anthropic:sk-ant-xxxxxxxxxx...
        # OpenAI:    openai:sk-xxxxxxxxxx...
        # OpenRouter: openrouter:sk-or-xxxxxxxxxx...
        ```

6.  **Register Slash Commands:**
    *   The project includes `register.js` to register all necessary commands (`/status`, `/template`, `/profile`, `/emoji`, `/health`, `/purge`).
    *   **Set Environment Variables for Script:** Create a `.dev.vars` file in the project root (add to `.gitignore`!) or set environment variables directly:
        ```dotenv
        # .dev.vars (Add this file to .gitignore!)
        DISCORD_APPLICATION_ID=YOUR_APP_ID_HERE
        DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
        ```
    *   **Run the script:**
        ```bash
        node register.js
        ```
        Run this once successfully, or whenever command definitions in `src/discord/commands.js` change.

7.  **Deploy the Worker:**
    *   Deploy to your desired environment (e.g., development):
        ```bash
        wrangler deploy --env development
        # or
        # wrangler deploy --env production
        ```
    *   Note the environment-specific URL output by Wrangler.

8.  **Configure Discord Interaction Endpoint URL:**
    *   Go to your application in the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Paste the **environment-specific URL** from the previous step into the "Interactions Endpoint URL" field, appending `/interactions`.
        *   Example: `https://discord-status-dashboard-development.<your-subdomain>.workers.dev/interactions`
    *   Click "Save Changes".

## Usage

*   **Update Status:** `/status update text: <Your status description>`
*   **Use Template:** `/template use name: <template_name>`
*   **Manage Templates:**
    *   `/template list [category: <category_name>]`
    *   `/template save name: <name> text: <status_text> [emoji: <emoji>] [category: <category>]`
    *   `/template delete name: <template_name>`
    *   `/template export name: <template_name>` (*Placeholder*)
    *   `/template import code: <export_code>` (*Placeholder*)
*   **Manage Profile:**
    *   `/profile view`
    *   `/profile theme value: <theme_name>`
    *   `/profile timezone value: <timezone_identifier>`
    *   `/profile visibility value: <public|private>`
*   **Manage Custom Emojis:**
    *   `/emoji list`
    *   `/emoji set state: <state_name> emoji: <emoji>`
    *   `/emoji reset state: <state_name>`
*   **Interact with Status Messages:** Use the buttons ("Check In", "Show Details", "Join Activity") and the "Quick React" select menu on status embeds.
*   **Utilities:**
    *   `/health` (Shows bot status, ephemeral)
    *   `/purge confirm` (Deletes all your data, irreversible!)

## Configuration Details

The application uses a layered configuration approach managed by `src/config.js`:

1.  **`wrangler.toml` (`[env.*].vars`):** Defines non-sensitive variables per environment (e.g., `ENVIRONMENT`, `DISCORD_PUBLIC_KEY`, `STATUS_CHANNEL_ID`, `LLM_MODEL`).
2.  **Wrangler Secrets:** Used for sensitive credentials (`DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `LLM_CREDENTIALS`). Injected at runtime.
3.  **Cloudflare KV (`app_config` key - Optional):** Allows dynamic runtime configuration changes via KV.

## Development

*   **Local Server:** `wrangler dev`
*   **Local Tunneling:** Use `cloudflared tunnel --url http://localhost:8787` or ngrok to expose your local server for Discord interactions. Update the Discord Interactions Endpoint URL with the tunnel address.
*   **Local Secrets:** Use a `.dev.vars` file (in `.gitignore`) for local testing of secrets if needed.

## Contributing

(Add contribution guidelines if applicable)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
