// src/discord/components.js - Handlers for message component interactions

import { InteractionResponseType } from './interactions.js'; // Import response types if needed
import { withExpirationCheck } from '../utils/component-expiration.js';
// Import specific KV functions needed
import { getLatestUserStatus, getUserStatusHistory, logUserInteraction as logInteractionToKV, getStatusUpdateCountToday } from '../storage/kv.js';
import { getUserProfile } from '../storage/profile.js'; // For show details
import { getActivity, joinActivity } from '../storage/activity.js'; // For join activity
// Import necessary API functions for responses
import { sendDirectMessage, editInteractionResponse, sendInteractionFollowup } from './api.js';
import { getRelativeTime } from '../utils/time.js'; // For show details

// Removed placeholder logUserInteraction, using imported logInteractionToKV


// --- Component Handlers ---

async function handleCheckIn(interaction, params, context) {
    const { config } = context; // Get config from context
    const kvStore = config.getKvBinding(); // Get kvStore from config
    const [targetUserId] = params; // Timestamp is ignored by this handler but present for expiration check
    const interactingUserId = interaction.member?.user?.id || interaction.user?.id;

    if (!targetUserId || !interactingUserId) {
        return { content: "Error identifying users for check-in.", ephemeral: true };
    }

    try {
        // Send DM notification to the status owner
        await sendDirectMessage(targetUserId, {
            content: `<@${interactingUserId}> checked in on your status!`
        }, config);

        // Log the interaction using the imported function
        await logInteractionToKV(targetUserId, interactingUserId, 'check_in', new Date().toISOString(), kvStore);

        // Respond ephemerally to the user who clicked
        return {
            content: `👋 You checked in with <@${targetUserId}>.`,
            ephemeral: true
        };
    } catch (error) {
        console.error(`Error handling check-in for target ${targetUserId}:`, error);
        return { content: "Failed to send check-in notification.", ephemeral: true };
    }
}

async function handleJoinActivity(interaction, params, context) {
    const { config } = context; // Get config from context
    const kvStore = config.getKvBinding(); // Get kvStore from config
    // Custom ID format: join_activity:targetUserId:timestamp:activityId
    const [targetUserId, _, activityId] = params; // activityId is the 3rd param
    const interactingUserId = interaction.member?.user?.id || interaction.user?.id;

    if (!activityId) {
        return { content: "No activity ID associated with this button.", ephemeral: true };
    }
    if (!targetUserId || !interactingUserId) {
        return { content: "Error identifying users for joining activity.", ephemeral: true };
    }

    try {
        // Attempt to join the activity
        const updatedActivity = await joinActivity(activityId, interactingUserId, kvStore);

        if (!updatedActivity) {
             // joinActivity throws specific errors, but catch general failure too
             throw new Error("Could not join activity or activity not found.");
        }

        // Log the interaction using the imported function
        await logInteractionToKV(targetUserId, interactingUserId, 'join_activity', new Date().toISOString(), kvStore);

        // Format participant list
        const participantsList = updatedActivity.participants.map(id => `<@${id}>`).join(', ');

        // Respond publicly confirming the join using a FOLLOWUP message
        // The initial response was DEFERRED_UPDATE_MESSAGE, but we don't actually update the original message.
        // We send a new message instead.
        await sendInteractionFollowup(interaction.token, {
            content: `🤝 <@${interactingUserId}> has joined <@${targetUserId}>'s activity: **${updatedActivity.title}**!\n\nCurrent participants: ${participantsList}`,
            // Explicitly send an empty allowed_mentions object
            allowed_mentions: {}
            // flags: 0 // Make it public (default)
        }, config);

        // Indicate successful async handling
        return;

    } catch (error) {
        console.error(`Error joining activity ${activityId} for user ${interactingUserId}:`, error);
        // If joining fails, try sending an ephemeral followup error message
        try {
             await sendInteractionFollowup(interaction.token, {
                 content: `❌ Error joining activity: ${error.message}`,
                 flags: 64 // Ephemeral
             }, config);
         } catch (followupError) {
              console.error(`Failed to send join activity error followup:`, followupError);
         }
        // We don't re-throw or return anything here as we attempted error reporting via followup
    }
}

async function handleQuickReact(interaction, params, context) {
    const { config } = context; // Get config from context
    const kvStore = config.getKvBinding(); // Attempt to get kvStore from config
    const [targetUserId] = params;
    const interactingUserId = interaction.member?.user?.id || interaction.user?.id;
    const selectedValue = interaction.data.values[0]; // Selected option value

    if (!targetUserId || !interactingUserId || !selectedValue) {
        return { content: "Error processing reaction.", ephemeral: true };
    }

    // Define reaction messages for each option
    const reactionMessages = {
        'im_in': `<@${interactingUserId}> wants to join <@${targetUserId}>! 👍`,
        'not_now': `<@${interactingUserId}> can't join <@${targetUserId}> right now. Maybe later! ⏱️`,
        'feel_better': `<@${interactingUserId}> hopes <@${targetUserId}> feels better soon! 💗`,
        'good_job': `<@${interactingUserId}> congratulates <@${targetUserId}> on their progress! 🎉`,
        'need_help': `<@${interactingUserId}> is offering help to <@${targetUserId}>! 🆘`
    };

    // Get appropriate message
    const messageContent = reactionMessages[selectedValue] || `<@${interactingUserId}> reacted to <@${targetUserId}>'s status!`;

    try {
        // Log the interaction using the imported function
        await logInteractionToKV(targetUserId, interactingUserId, `react_${selectedValue}`, new Date().toISOString(), kvStore);

        // Now, instead of returning data, directly edit the original interaction response
        // The initial response should be DEFERRED_UPDATE_MESSAGE handled by the caller
        await editInteractionResponse(interaction.token, {
            content: messageContent,
            // Explicitly send an empty allowed_mentions object
            allowed_mentions: {}
            // Keep original embeds/components by not specifying them
        }, config);

        // Since we handled the response via edit, we don't return anything here for the main router
        // The main router already sent the DEFERRED_UPDATE_MESSAGE
        return; // Indicate successful async handling

    } catch (error) {
         console.error(`Error handling quick react for target ${targetUserId}:`, error);
         // If editing fails, try sending a followup error message
         // Use try/catch as followup might also fail if token is invalid
         try {
             await sendInteractionFollowup(interaction.token, {
                 content: `❌ Failed to process reaction: ${error.message}`,
                 flags: 64 // Ephemeral
             }, config);
         } catch (followupError) {
              console.error(`Failed to send quick react error followup:`, followupError);
         }
         // We don't re-throw here as we attempted error reporting
    }
}

async function handleShowDetails(interaction, params, context) {
    const { config } = context; // Get config from context
    // Attempt to get kvStore from config immediately
    const kvStore = config.getKvBinding();
    const [targetUserId] = params;
    const interactingUserId = interaction.member?.user?.id || interaction.user?.id;

     if (!targetUserId || !interactingUserId) {
        return { content: "Error identifying user for details.", ephemeral: true };
    }

    try {
        // --- FOCUSED DEBUGGING ---
        console.log(`[handleShowDetails] Type of kvStore before use: ${typeof kvStore}`);
        if (!kvStore) {
             console.error("[handleShowDetails] CRITICAL: kvStore variable is null or undefined right before use!");
             return { content: "Internal Error: Storage unavailable (debug).", ephemeral: true };
        }
        // --- END FOCUSED DEBUGGING ---

        // Get the user's latest status and profile using the kvStore variable
        const latestStatus = await getLatestUserStatus(targetUserId, kvStore);
        const userProfile = await getUserProfile(targetUserId, kvStore);

        if (!latestStatus || !latestStatus.processed_status) {
            return {
                content: `No status information available for <@${targetUserId}>.`,
                ephemeral: true
            };
        }

        // Format detailed stats based on the status data
        const statusData = latestStatus.processed_status;

        // Format detailed metrics
        const detailedMetrics = (statusData.metrics || [])
            .map(metric => `${metric.icon || '•'} **${metric.name}**: ${metric.value} ${metric.value_rating ? `(${metric.value_rating}/5)` : ''}`)
            .join('\n') || '_No metrics available._';

        // Format personal states
        const personalStates = (statusData.personal_states || [])
            .map(state => `${state.emoji || '•'} **${state.name}**: Level ${state.level || 'N/A'} ${state.time_since_last ? `(Last: ${state.time_since_last})` : ''}`)
            .join('\n') || '_No personal states available._';

        // Format highlights
        const highlights = (statusData.highlights || [])
            .map(h => `${h.is_new ? '✨' : '🔄'} ${h.description}`)
            .join('\n') || '_No highlights available._';

        // Format history summary if available
        let historySection = '';
        if (latestStatus.timestamp) {
            // Use relative time for display
            const relativeTime = getRelativeTime(latestStatus.timestamp); // Timezone maybe later
            historySection = `\n\n**Status History**\nLast updated: ${relativeTime}`;
            // Add update count
            const updateCount = await getStatusUpdateCountToday(targetUserId, kvStore); // Call the function
            historySection += `\nStatus updates today: ${updateCount}`;
        }

        // Log the interaction using the imported function
        await logInteractionToKV(targetUserId, interactingUserId, 'show_details', new Date().toISOString(), kvStore);

        // Format detailed view
        return {
            embeds: [{
                title: `${statusData.mood_emoji || '📊'} Detailed Status for <@${targetUserId}>`,
                description: `Current status: **${statusData.overall_status}**\n\n${statusData.narrative_summary || '_No summary provided._'}`,
                color: 0x7289da, // Blurple or use theme color if desired
                fields: [
                    { name: '📊 Detailed Metrics', value: detailedMetrics, inline: false },
                    { name: '🧬 Personal States', value: personalStates, inline: false },
                    { name: '💡 Highlights', value: highlights, inline: false },
                    { name: '💬 Raw Status Input', value: `\`\`\`\n${latestStatus.raw_input?.substring(0, 1000) || 'Not available'}\n\`\`\``, inline: false }
                ],
                footer: { text: historySection || 'Status details' },
                timestamp: latestStatus.timestamp // Show timestamp of the status itself
            }],
            ephemeral: true // Show only to the user who clicked
        };
    } catch (error) {
        console.error(`Error showing status details for ${targetUserId}:`, error);
        return {
            content: 'An error occurred while retrieving status details.',
            ephemeral: true
        };
    }
}

// --- Component Interaction Router ---

// Wrap handlers with expiration check
const handleCheckInExpired = withExpirationCheck(handleCheckIn);
const handleJoinActivityExpired = withExpirationCheck(handleJoinActivity);
const handleQuickReactExpired = withExpirationCheck(handleQuickReact);
const handleShowDetailsExpired = withExpirationCheck(handleShowDetails);

/**
 * Main handler for all message component interactions.
 * Routes based on the first part of the custom_id.
 * @param {Object} interaction - Discord interaction data.
 * @param {Object} context - Worker context containing config, ctx, kvStore.
 * @returns {Promise<Object>} - Interaction response data object.
 */
export async function handleComponentInteraction(interaction, context) {
  try {
    const customId = interaction.data.custom_id;
    const [action, ...params] = customId.split(':');

    console.log(`Handling component action: ${action} with params: ${params}`);

    switch (action) {
      case 'check_in':
        // Pass the full context down to the wrapped handler
        return await handleCheckInExpired(interaction, params, context);
      case 'join_activity':
        // Pass the full context down to the wrapped handler
        return await handleJoinActivityExpired(interaction, params, context);
      case 'react':
         // Pass the full context down to the wrapped handler
        return await handleQuickReactExpired(interaction, params, context);
      case 'show_details':
         // Pass the full context down to the wrapped handler
        return await handleShowDetailsExpired(interaction, params, context);
      default:
        console.warn(`Unknown component action: ${action}`);
        return {
          content: `Unknown component action: ${action}`,
          ephemeral: true
        };
    }
  } catch (error) {
    console.error('Error handling component interaction:', error);
    // Don't try to send another response if one might have already been sent by the handler
    // Log the error thoroughly. The main interaction handler might send a generic followup.
    // Depending on where the error occurred, returning a specific response here might fail.
    // Consider just logging and letting the main handler attempt a followup.
    return {
        content: 'An error occurred while processing your interaction.',
        ephemeral: true
    };
  }
}
