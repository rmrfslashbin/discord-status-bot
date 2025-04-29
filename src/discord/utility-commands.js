// src/discord/utility-commands.js - Handlers for utility slash commands

import { purgeUserData } from '../storage/kv.js';

/**
 * Handle /health slash command.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object.
 */
export async function handleHealthCommand(interaction, context) {
  const { config } = context;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  console.log(`Processing /health command for user ${userId}`);

  // Format the health information
  const healthInfo = {
    status: 'healthy',
    version: config.getVersion(),
    environment: config.getValue('environment', 'unknown'),
    buildId: config.getBuildId(),
    timestamp: new Date().toISOString()
  };

  const responseContent = `\`\`\`json\n${JSON.stringify(healthInfo, null, 2)}\n\`\`\``;

  return {
    content: responseContent,
    ephemeral: true // Show only to the user who invoked it
  };
}

/**
 * Handle /purge slash command.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object.
 */
export async function handlePurgeCommand(interaction, context) {
  const { config } = context;
  const kvStore = config.getKvBinding();
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // Options are now nested: status -> purge -> options
  const purgeCommandOption = interaction.data.options?.[0]; // This is the 'purge' subcommand object
  const options = purgeCommandOption?.options || []; // Get options of the 'purge' subcommand

  if (!userId || !kvStore) {
    return { content: "Error: Could not identify user or access storage.", ephemeral: true };
  }

  console.log(`Processing /status purge command for user ${userId}`);

  // Check if the required 'confirm' option is present and true
  const confirmOption = options.find(opt => opt.name === 'confirm');

  if (confirmOption?.value === true) {
      // Confirmation received, proceed with purge
      try {
          const deletedCount = await purgeUserData(userId, kvStore);
          console.log(`Purged ${deletedCount} keys for user ${userId}.`);
          return {
              content: `✅ Successfully purged ${deletedCount} data entries associated with your user ID.`,
              ephemeral: true
          };
      } catch (error) {
          console.error(`Error purging data for user ${userId}:`, error);
          return {
              content: `❌ An error occurred while purging your data: ${error.message}`,
              ephemeral: true
          };
      }
  } else {
      // If 'confirm' option is missing or false (shouldn't happen if required=true, but good to handle)
      // This path should ideally not be reached if the command definition requires 'confirm: true'.
      // Discord's UI should enforce setting the required boolean.
      // If somehow reached, it implies the command was invoked incorrectly or the definition failed.
      console.warn(`Purge command invoked for user ${userId} without required 'confirm: true' option.`);
      return {
          content: "❌ Purge command requires explicit confirmation. Please use `/status purge confirm: True`.",
          ephemeral: true
      };
  }
}

/**
 * Handle /info slash command.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object.
 */
export async function handleInfoCommand(interaction, context) {
    const { config } = context;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const repoUrl = "https://github.com/rmrfslashbin/discord-status-bot"; // Define repo URL

    console.log(`Processing /status info command for user ${userId}`);

    // Construct the help/info embed - Update command examples
    const embed = {
        title: "ℹ️ Status Dashboard Bot Info",
        description: `Hello! I'm a bot that uses AI to analyze your status updates and display them in a dynamic dashboard.\n\nSource Code: [${repoUrl}](${repoUrl})`,
        color: 0x5865F2, // Discord Blurple
        fields: [
             {
                name: "Core Commands",
                value: "`/status update text: <your status>` - Update your status.\n" +
                       "`/status template list [category: <name>]` - List your templates.\n" +
                       "`/status template use name: <name>` - Use a saved template.\n" +
                       "`/status template save name: <name> text: <text> [emoji: <emoji>] [category: <category>]` - Save a template.\n" +
                       "`/status template delete name: <name>` - Delete a template."
            },
            {
                name: "Customization",
                value: "`/status profile view` - View your settings.\n" +
                       "`/status profile theme value: <theme>` - Set your default theme.\n" +
                       "`/status profile timezone value: <timezone>` - Set your timezone.\n" +
                       "`/status emoji list` - List your custom emojis.\n" +
                       "`/status emoji set state: <state> emoji: <emoji>` - Set a custom emoji.\n" +
                       "`/status emoji reset state: <state>` - Reset a custom emoji."
            },
            {
                name: "Utilities",
                value: "`/status health` - Check bot status.\n" +
                       "`/status purge confirm: True` - **IRREVERSIBLY** delete all your data.\n" +
                       "`/status info` - Show this help message."
            }
        ],
        footer: {
            text: `Version: ${config.getVersion()} | Build ID: ${config.getBuildId()}`
        }
    };

    return {
        embeds: [embed],
        ephemeral: true // Show only to the user who invoked it
    };
}
