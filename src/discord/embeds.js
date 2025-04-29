// src/discord/embeds.js - Message formatting using themes

// Import theme definitions and helper functions
import { statusThemes, createProgressBar, getTrendIndicator, ratingToBlocks } from './themes.js';
import { hexColorToInt } from '../utils/color.js'; // Keep for accent_color fallback if needed


/**
 * Format status data (new schema) into a Discord message payload using themes and profile data.
 * @param {Object} statusData - The structured status data (potentially with custom emojis applied).
 * @param {string} userId - Discord user ID for mentioning.
 * @param {Object | null} [previousStatus=null] - Optional previous status data for context.
 * @param {Object | null} [userProfile=null] - Optional user profile data.
 * @returns {Object} - Formatted Discord message payload (suitable for POST/PATCH).
 */
export function formatDiscordMessage(statusData, userId, previousStatus = null, userProfile = null) {
  // Safely access potentially missing nested properties
  const safeGet = (obj, path, defaultValue = undefined) => {
      return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' && acc[key] !== undefined && acc[key] !== null) ? acc[key] : defaultValue, obj);
  };

  // --- Determine Theme (Use profile preference as fallback) ---
  const userDefaultTheme = safeGet(userProfile, 'preferences.theme', 'default');
  const statusThemeName = safeGet(statusData, 'visual_theme'); // Theme from LLM might override profile
  const themeName = statusThemeName || userDefaultTheme; // Use status theme if present, else profile theme
  const theme = statusThemes[themeName] || statusThemes.default; // Fallback to default theme

  // --- Determine Embed Color (Use theme color) ---
  const embedColor = theme.color;

  // --- Format Metrics using Progress Bars ---
  const metrics = safeGet(statusData, 'metrics', []);
  let metricsFields = metrics.map(metric => {
      const trendIndicator = getTrendIndicator(safeGet(metric, 'trend'));
      // Use value_rating for progress bar, default to 0 if missing
      const rating = safeGet(metric, 'value_rating', 0);
      const progressBar = createProgressBar(rating, 5, theme); // Use theme characters
      const valueDisplay = safeGet(metric, 'value', 'N/A'); // Show textual value too

      return {
          name: `${safeGet(metric, 'icon', '❔')} ${safeGet(metric, 'name', 'Metric')}`,
          value: `${trendIndicator} ${progressBar} (${rating}/5)\n*Value: ${valueDisplay}*`, // Show rating and text value
          inline: true // Metrics usually look better inline
      };
  });
   // Add a blank inline field if metrics count is odd, to prevent single large field
   if (metricsFields.length % 2 !== 0) {
       metricsFields.push({ name: '\u200B', value: '\u200B', inline: true });
  }

  // --- Format Highlights ---
  const highlights = safeGet(statusData, 'highlights', []);
  let highlightsString = highlights.map(highlight => {
      const newIndicator = highlight.is_new ? '✨' : '🔄'; // Sparkle for new, refresh for updated/carried over
      const typeEmojiMap = {
          activity: '🏃', event: '📅', state: '💭', need: '❗', achievement: '🏆', blocker: '🚧', default: '📌'
      };
      const typeEmoji = typeEmojiMap[highlight.type] || typeEmojiMap.default;
      const timeframePart = highlight.timeframe ? ` (${highlight.timeframe})` : '';
      const description = highlight.description || 'Highlight';

      return `${newIndicator} ${typeEmoji} ${description}${timeframePart}`;
  }).join('\n');

  if (!highlightsString) {
      highlightsString = '_No specific highlights identified._';
  }

  // --- Format Persistent Context ---
  const persistentContext = safeGet(statusData, 'persistent_context', []);
  let persistentContextString = persistentContext
      .filter(p => p.from_previous) // Only show items marked as carried over
      .map(p => {
          // Optionally add source timestamp if needed: ` (from ${new Date(p.source_timestamp).toLocaleDateString()})`
          return `⏳ ${safeGet(p, 'description', 'Persistent context')}`;
      }).join('\n');

  // --- Format Personal States ---
  const personalStates = safeGet(statusData, 'personal_states', []);
  let personalStatesString = personalStates.map(state => {
      const trendIndicator = getTrendIndicator(safeGet(state, 'trend'));
      const level = safeGet(state, 'level', 0);
      // Use ratingToBlocks helper
      const blocks = ratingToBlocks(level); // Use the block function
      let stateText = `${safeGet(state, 'emoji', '❔')} **${safeGet(state, 'name', 'Unknown')}:** ${trendIndicator} ${blocks} (${level}/5)`;

      const timeSinceLast = safeGet(state, 'time_since_last');
      if (timeSinceLast) {
          stateText += ` | Last: ${timeSinceLast}`;
      }
      return stateText;
  }).join('\n');

  // --- Create Embed Fields ---
  const fields = [];

  // Add Metrics fields (if any)
  if (metricsFields.length > 0) {
      fields.push(...metricsFields);
       // Add a separator field after metrics if other sections follow
       if (highlightsString !== '_No specific highlights identified.' || persistentContextString || personalStatesString) {
           fields.push({ name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━', inline: false });
       }
  }


  // Add Highlights field
  fields.push({
      name: '💡 Highlights',
      value: highlightsString,
      inline: false
  });

  // Add Persistent Context field only if there's content
  if (persistentContextString) {
      fields.push({
          name: '⏳ Continuing Context',
          value: persistentContextString,
          inline: false
      });
  }

   // Add a separator before summary/errors if needed
   // The logic for adding the "Personal State" field is handled earlier with personalStatesString
   if (fields.length > 0 && (safeGet(statusData, 'errors', []).length > 0 || safeGet(statusData, 'narrative_summary'))) {
       fields.push({ name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━', inline: false });
   }

  // --- Add Errors Field (if any) ---
  // This field will now display errors from the LLM or our fallback logic
  const errors = safeGet(statusData, 'errors', []);
  if (Array.isArray(errors) && errors.length > 0) {
      const errorString = errors.map(e => `- ${e}`).join('\n');
      // Limit error display length to avoid huge embeds
      const truncatedErrorString = errorString.length > 1000 ? errorString.substring(0, 997) + '...' : errorString;
      fields.push({
          name: '⚠️ Analysis Issues',
          value: truncatedErrorString, // Display the errors from the statusData.errors array
          inline: false
      });
  }

  // Add Narrative Summary field (unless it's the default failure message)
  const narrativeSummary = safeGet(statusData, 'narrative_summary', '');
  // Avoid showing the generic "Analysis failed." summary if we already showed specific errors.
  // Only show a meaningful summary if one was generated.
  if (narrativeSummary && !narrativeSummary.startsWith('Analysis failed.')) {
      fields.push({
          name: '📝 Summary',
          value: narrativeSummary,
          inline: false
      });
  } else if (!narrativeSummary && errors.length === 0) {
       // If there's no summary AND no errors, show a placeholder
       fields.push({
          name: '📝 Summary',
          value: '_No summary provided._',
          inline: false
      });
  }

  // --- Create the Embed ---
  const embed = {
    // Use theme prefix and accent bar in title
    title: `${theme.emoji_prefix} ${safeGet(statusData, 'mood_emoji', '👤')} ${theme.accent_bar}`,
    description: `<@${userId}>'s Status: **${safeGet(statusData, 'overall_status', 'Status Update')}**\n*Updated: <t:${Math.floor(Date.now() / 1000)}:R>*`,
    color: embedColor, // Use theme color
    fields: fields,
    footer: {
      // Include theme name in footer
      text: `Theme: ${themeName} • Powered by AI` // Removed localeString for consistency
      // icon_url: "URL_TO_YOUR_BOT_ICON"
    },
    timestamp: new Date().toISOString() // Use ISO timestamp
  };

  // --- Add Components (Buttons & Select Menu) ---
  // Generate a timestamp for component IDs to enable expiration checks
  const componentTimestamp = Date.now();

  // Define base components
  const baseComponents = [
      { // Row 1: Buttons
          type: 1, // ActionRow
          components: [
              {
                  type: 2, // Button
                  style: 2, // Secondary style (gray)
                  // Custom ID format: action:targetUserId:timestamp
                  custom_id: `check_in:${userId}:${componentTimestamp}`,
                  label: "Check In",
                  emoji: { name: "👋" }
              },
              {
                  type: 2, // Button
                  style: 1, // Primary style (blurple)
                  custom_id: `show_details:${userId}:${componentTimestamp}`,
                  label: "Show Details",
                  emoji: { name: "🔍" }
              }
          ]
      },
      { // Row 2: Select Menu
          type: 1, // ActionRow
          components: [
              {
                  type: 3, // Select Menu
                  custom_id: `react:${userId}:${componentTimestamp}`,
                  placeholder: "Quick React...",
                  options: [
                      { label: "I'm in!", value: "im_in", description: "Let them know you want to join", emoji: { name: "✅" } },
                      { label: "Not now", value: "not_now", description: "Let them know you're busy", emoji: { name: "⏱️" } },
                      { label: "Feel better!", value: "feel_better", description: "Send encouragement", emoji: { name: "💗" } },
                      { label: "Good job!", value: "good_job", description: "Congratulate them", emoji: { name: "🎉" } },
                      { label: "Need help?", value: "need_help", description: "Offer assistance", emoji: { name: "🆘" } }
                  ]
              }
          ]
      }
  ];

  // Conditionally add "Join Activity" button
  const activityHighlight = safeGet(statusData, 'highlights', []).find(h =>
      h.type === 'activity' && (h.timeframe === 'current' || h.timeframe === 'future')
  );

  // Retrieve activityId if it was created and passed in statusData (requires change in api/status.js)
  const activityId = safeGet(statusData, 'activity_id'); // Assuming activityId is added to statusData

  if (activityHighlight && activityId) {
      // Add Join button to the first row if there's space, otherwise create new row (limit 5 components per row)
      if (baseComponents[0].components.length < 5) {
          baseComponents[0].components.push({
              type: 2, // Button
              style: 3, // Success style (green)
              // Custom ID format: action:targetUserId:timestamp:activityId
              custom_id: `join_activity:${userId}:${componentTimestamp}:${activityId}`,
              label: "Join Activity",
              emoji: { name: "🤝" }
          });
      } else {
          // Add Join button in its own row if the first row is full
          baseComponents.splice(1, 0, { // Insert before the select menu row
               type: 1,
               components: [{
                  type: 2, style: 3,
                  custom_id: `join_activity:${userId}:${componentTimestamp}:${activityId}`,
                  label: "Join Activity", emoji: { name: "🤝" }
               }]
          });
      }
  }


  // --- Return the full message payload ---
  return {
    embeds: [embed],
    components: baseComponents, // Use the dynamically built components array
    allowed_mentions: { parse: [] }
  };
}

// Remove duplicated helper function as it's now imported from themes.js
// function ratingToBlocks(rating) { ... }
