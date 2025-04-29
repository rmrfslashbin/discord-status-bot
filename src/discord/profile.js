// src/discord/profile.js - Handler for /profile slash commands

import { getUserProfile, updateUserProfile } from '../storage/profile.js';
import { statusThemes } from './themes.js'; // Import themes for validation

// Valid timezone identifiers (example subset - use a library like moment-timezone for full validation if needed)
// For simplicity, we'll allow any string for now, but validation is recommended.
// const validTimezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', ...];
const validThemes = Object.keys(statusThemes);
const validVisibilities = ['public', 'private']; // Adjust if more options are added

/**
 * Handle /profile slash command interactions.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object (content or embeds).
 */
export async function handleProfileCommand(interaction, context) {
  const configInstance = context.config;
  const kvStore = configInstance.getKvBinding();
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // Options are now nested: status -> profile -> subcommand -> options
  const profileSubCommandOption = interaction.data.options?.[0]?.options?.[0];
   if (!profileSubCommandOption) {
      console.error('Could not find profile subcommand option in interaction data.');
      return { content: "Error: Invalid command structure received.", ephemeral: true };
  }

  const subcommand = profileSubCommandOption.name;
  const options = profileSubCommandOption.options || []; // Get the actual options for the subcommand

  if (!userId || !kvStore) {
    return { content: "Error: Could not identify user or access storage.", ephemeral: true };
  }

  console.log(`Processing /profile ${subcommand} for user ${userId}`);

  try {
    switch (subcommand) {
      case 'view': {
        const profile = await getUserProfile(userId, kvStore);
        return formatProfileView(profile, userId);
      }

      case 'timezone': {
        const timezoneOption = options.find(opt => opt.name === 'value');
        const timezone = timezoneOption?.value;
        // Basic validation
        if (!timezone || typeof timezone !== 'string' || timezone.trim().length === 0) {
            return { content: "Invalid timezone provided.", ephemeral: true };
        }
        // TODO: Add robust timezone validation using a library if possible in CF Worker env
        const success = await updateUserProfile(userId, { timezone: timezone.trim() }, kvStore);
        return {
          content: success ? `✅ Timezone updated to "${timezone.trim()}"!` : `❌ Error updating timezone.`,
          ephemeral: true
        };
      }

      case 'theme': {
        const themeOption = options.find(opt => opt.name === 'value');
        const theme = themeOption?.value;
        if (!theme || !validThemes.includes(theme)) {
          return { content: `Invalid theme "${theme}". Valid themes are: ${validThemes.join(', ')}`, ephemeral: true };
        }
        const success = await updateUserProfile(userId, { 'preferences.theme': theme }, kvStore);
        return {
          content: success ? `✅ Default theme updated to "${theme}"!` : `❌ Error updating theme.`,
          ephemeral: true
        };
      }

       case 'visibility': {
        const visibilityOption = options.find(opt => opt.name === 'value');
        const visibility = visibilityOption?.value;
        if (!visibility || !validVisibilities.includes(visibility)) {
          return { content: `Invalid visibility "${visibility}". Valid options are: ${validVisibilities.join(', ')}`, ephemeral: true };
        }
        const success = await updateUserProfile(userId, { 'preferences.visibility': visibility }, kvStore);
        return {
          content: success ? `✅ Profile visibility updated to "${visibility}"!` : `❌ Error updating visibility.`,
          ephemeral: true
        };
      }

      default:
        return { content: "Unknown profile command.", ephemeral: true };
    }
  } catch (error) {
    console.error(`Error handling /profile ${subcommand} for user ${userId}:`, error);
    return { content: `❌ An unexpected error occurred: ${error.message}`, ephemeral: true };
  }
}

/**
 * Format the user profile for display in Discord.
 * @param {Object} profile - The user profile object.
 * @param {string} userId - The Discord user ID.
 * @returns {Object} - Discord interaction response data object.
 */
function formatProfileView(profile, userId) {
    const fields = [
        { name: "👤 User", value: `<@${userId}>`, inline: true },
        { name: "🎨 Default Theme", value: profile.preferences?.theme || 'default', inline: true },
        { name: "🌍 Timezone", value: profile.timezone || 'Not Set', inline: true },
        { name: "👁️ Visibility", value: profile.preferences?.visibility || 'public', inline: true },
        { name: "✨ Custom Emojis", value: Object.keys(profile.custom_emojis || {}).length > 0 ? `Set (${Object.keys(profile.custom_emojis).length})` : 'None Set', inline: true },
        { name: "🕒 Profile Updated", value: profile.updated_at ? `<t:${Math.floor(new Date(profile.updated_at).getTime()/1000)}:R>` : 'N/A', inline: true },
    ];

     // Add custom emoji list if any exist
     if (profile.custom_emojis && Object.keys(profile.custom_emojis).length > 0) {
        const emojiList = Object.entries(profile.custom_emojis)
            .map(([state, emoji]) => `${emoji} ${state}`)
            .join(', ');
        fields.push({ name: "Custom Emoji Details", value: emojiList, inline: false });
    }


  return {
    embeds: [{
      title: "⚙️ Your Profile Settings",
      description: "Here are your current profile settings. Use `/profile set <setting> <value>` to change them.",
      color: 0x5865F2, // Blurple
      fields: fields,
      footer: { text: `Profile created: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}` }
    }],
    ephemeral: true
  };
}
