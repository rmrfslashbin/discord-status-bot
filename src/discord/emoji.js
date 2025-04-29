// src/discord/emoji.js - Handler for /emoji slash commands

import { getUserEmojiSet, setCustomEmoji } from '../storage/profile.js';
// Import suggestions (optional, could be used for autocomplete later)
// import { getEmojiSuggestions } from './emoji-suggestions.js';

/**
 * Handle /emoji slash command interactions.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object (content or embeds).
 */
export async function handleEmojiCommand(interaction, context) {
  const configInstance = context.config;
  const kvStore = configInstance.getKvBinding();
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // Options are now nested: status -> emoji -> subcommand -> options
  const emojiSubCommandOption = interaction.data.options?.[0]?.options?.[0];
   if (!emojiSubCommandOption) {
      console.error('Could not find emoji subcommand option in interaction data.');
      return { content: "Error: Invalid command structure received.", ephemeral: true };
  }

  const subcommand = emojiSubCommandOption.name;
  const options = emojiSubCommandOption.options || []; // Get the actual options for the subcommand


  if (!userId || !kvStore) {
    return { content: "Error: Could not identify user or access storage.", ephemeral: true };
  }

  console.log(`Processing /emoji ${subcommand} for user ${userId}`);

  try {
    switch (subcommand) {
      case 'list':
        return await formatEmojiList(userId, kvStore);

      case 'set': {
        const stateName = options.find(o => o.name === 'state')?.value;
        const emoji = options.find(o => o.name === 'emoji')?.value;

        if (!stateName || typeof stateName !== 'string' || !emoji || typeof emoji !== 'string') {
            return { content: "Error: Both state name and emoji are required.", ephemeral: true };
        }
        // Basic validation: Check if it's likely an emoji (very basic)
        // A more robust check might involve regex or libraries if needed.
        if (emoji.length > 5 || emoji.trim().length === 0) {
             return { content: "Invalid emoji provided. Please provide a single standard emoji.", ephemeral: true };
        }

        const success = await setCustomEmoji(userId, stateName.trim(), emoji.trim(), kvStore);
        return {
          content: success ? `✅ Custom emoji for "${stateName.trim()}" set to ${emoji.trim()}!` : `❌ Error setting custom emoji.`,
          ephemeral: true
        };
      }

      case 'reset': {
        const stateToReset = options.find(o => o.name === 'state')?.value;
         if (!stateToReset || typeof stateToReset !== 'string') {
            return { content: "Error: State name is required.", ephemeral: true };
        }

        // Setting to empty string will remove it in setCustomEmoji
        const success = await setCustomEmoji(userId, stateToReset.trim(), "", kvStore);
        return {
          content: success ? `🗑️ Custom emoji for "${stateToReset.trim()}" has been reset to default.` : `❌ Error resetting custom emoji.`,
          ephemeral: true
        };
      }

      default:
        return { content: "Unknown emoji command.", ephemeral: true };
    }
  } catch (error) {
    console.error(`Error handling /emoji ${subcommand} for user ${userId}:`, error);
    return { content: `❌ An unexpected error occurred: ${error.message}`, ephemeral: true };
  }
}

/**
 * Format the custom emoji list for display in Discord.
 * @param {string} userId - The Discord User ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object>} - Discord interaction response data object.
 */
async function formatEmojiList(userId, kvStore) {
  try {
    const customEmojis = await getUserEmojiSet(userId, kvStore); // Pass kvStore

    if (!customEmojis || Object.keys(customEmojis).length === 0) {
      return {
        content: "You don't have any custom emojis set up yet. Use `/emoji set state: <state_name> emoji: <emoji>` to create one!",
        ephemeral: true
      };
    }

    // Format emoji list
    const emojiList = Object.entries(customEmojis)
      // Filter out entries where the value might be empty/null if reset logic changes
      .filter(([_, emoji]) => emoji)
      .map(([state, emoji]) => `${emoji} **${state}**`)
      .join('\n');

    return {
      embeds: [{
        title: "🎨 Your Custom Emojis",
        description: "Here are your custom emojis for status indicators:\n\n" + (emojiList || "_No custom emojis set._"),
        color: 0x7289da, // Blurple
        footer: {
          text: "Use /emoji set|reset to manage your custom emojis"
        }
      }],
      ephemeral: true
    };
  } catch (error) {
    console.error(`Error formatting emoji list for user ${userId}:`, error);
    return {
      content: "❌ Error retrieving your custom emojis. Please try again later.",
      ephemeral: true
    };
  }
}
