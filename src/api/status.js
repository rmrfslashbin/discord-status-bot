// src/api/status.js - Core status update processing logic with context awareness

import { processWithLLM } from '../llm/processor.js';
import { formatDiscordMessage } from '../discord/embeds.js';
import { createStatusMessage } from '../discord/api.js';
// Import KV storage functions for history/latest status
import { getLatestUserStatus, storeUserStatus } from '../storage/kv.js';
// Import profile storage functions
import { getUserProfile } from '../storage/profile.js';
// Import context relevance and time tracking functions
import { calculateContextRelevance, filterRelevantContext, updatePersonalStateTimes } from '../llm/context.js';
// Import activity creation function
import { createActivity } from '../storage/activity.js';


/**
 * Core function to process a status update request with context awareness.
 * Fetches previous status, calculates relevance, filters context, processes with LLM,
 * stores new status, formats, and posts a *new* Discord message.
 * @param {string} statusText - The user's raw status narrative.
 * @param {string} userId - The Discord User ID of the person updating status.
 * @param {Configuration} configInstance - The application configuration instance.
 * @returns {Promise<string>} - The Discord message ID of the updated/created status message.
 * @throws {Error} - Throws errors if critical steps fail (e.g., config missing, Discord API fails).
 */
export async function processStatusUpdate(statusText, userId, configInstance) {
  if (!userId) {
    throw new Error('User ID is required to process status update.');
  }
  if (!statusText || typeof statusText !== 'string' || statusText.trim() === '') {
      throw new Error('Status text cannot be empty.');
  }

  console.log(`Starting context-aware status update process for user ${userId}`);

  try {
    // 1. Get necessary configuration
    const channelId = configInstance.getValue('discord.statusChannelId');
    const historyLimit = configInstance.getValue('storage.historyLimit', 20); // Get history limit from config or default
    const relevanceThreshold = configInstance.getValue('llm.relevanceThreshold', 0.3); // Get threshold from config or default

    if (!channelId) {
      throw new Error('Status channel ID (STATUS_CHANNEL_ID) is not configured.');
    }

    // --- Retrieve KV Store Binding ---
    // Get KV Store binding early to pass to storage functions
    const kvStore = configInstance.getKvBinding();
    if (!kvStore) {
        // Throw error immediately if storage is unavailable
        throw new Error("KV Store binding not available in processStatusUpdate");
    } else {
        console.log("Successfully retrieved KV Store binding in processStatusUpdate.");
    }
    // --- End KV Store Binding Retrieval ---

    // 2. Get the latest status entry for context, passing kvStore
    console.log(`Fetching latest status for user ${userId}...`);
    let previousStatus = await getLatestUserStatus(userId, kvStore);
    let filteredContext = null;

    // 3. Calculate relevance and filter context if previous status exists
    if (previousStatus) {
        console.log(`Calculating relevance for previous status (timestamp: ${previousStatus.timestamp})...`);
        const contextWithRelevance = calculateContextRelevance(previousStatus);
        console.log(`Filtering relevant context with threshold ${relevanceThreshold}...`);
        filteredContext = filterRelevantContext(contextWithRelevance, relevanceThreshold);
    } else {
        console.log(`No previous status found for user ${userId}.`);
    }

    // 4. Process the status text with the LLM, providing filtered context
    console.log(`Processing text with LLM for user ${userId} (context provided: ${!!filteredContext})...`);
    // Pass the filtered context object (which includes timestamp, raw_input, and filtered processed_status)
    const newStatusData = await processWithLLM(statusText, configInstance, filteredContext);
    console.log(`LLM processing complete for user ${userId}. Status: ${newStatusData.overall_status}`);

    // 4b. Update personal state time tracking using previous context
    if (previousStatus && previousStatus.processed_status) {
        console.log(`Updating personal state time tracking for user ${userId}...`);
        // Ensure personal_states exists on both, defaulting to empty arrays
        const prevPersonalStates = previousStatus.processed_status.personal_states || [];
        const currentPersonalStates = newStatusData.personal_states || [];
        newStatusData.personal_states = updatePersonalStateTimes(
            prevPersonalStates,
            currentPersonalStates,
            previousStatus.timestamp // Pass the timestamp of the previous status
        );
    } else {
         // If no previous status, ensure trend is 'new' if states exist
         if (newStatusData.personal_states && Array.isArray(newStatusData.personal_states)) {
             newStatusData.personal_states.forEach(state => state.trend = 'new');
         }
    }


    // 5. Store the new status entry (raw input + processed output with updated times/trends)
    console.log(`Storing new status for user ${userId}...`);
    // Call uses the kvStore variable defined earlier
    const storedStatusEntry = await storeUserStatus(userId, statusText, newStatusData, kvStore, historyLimit);
    if (!storedStatusEntry) {
        // Log error but proceed with posting the message if possible
        // Error logging now happens inside storeUserStatus
        console.error(`Failed to store status for user ${userId}, but proceeding to post message.`);
    } else {
        console.log(`Successfully stored new status for user ${userId} (timestamp: ${storedStatusEntry.timestamp})`);
    }

    // 5b. Load user profile for custom emojis and preferences
    console.log(`Loading profile for user ${userId}...`);
    // Call uses the kvStore variable defined earlier
    const userProfile = await getUserProfile(userId, kvStore);

    // 5c. Apply custom emojis to the processed status data
    let finalStatusData = applyCustomEmojis(newStatusData, userProfile.custom_emojis);
    console.log(`Applied custom emojis for user ${userId}.`);

    // 5d. Check for potential activity and create it
    let activityId = null;
    const activityHighlight = finalStatusData.highlights?.find(h =>
        h.type === 'activity' && (h.timeframe === 'current' || h.timeframe === 'future')
    );
    if (activityHighlight) {
        console.log(`Found potential activity highlight for user ${userId}: ${activityHighlight.description}`);
        activityId = await createActivity(
            userId,
            {
                title: activityHighlight.description,
                description: finalStatusData.narrative_summary || '',
                type: finalStatusData.visual_theme || 'general'
            },
            kvStore // Pass kvStore
        );
        if (activityId) {
            console.log(`Created activity ${activityId} for user ${userId}.`);
            // Add activityId to status data *only for passing to formatter*, don't store it in KV status history
            finalStatusData.activity_id = activityId;
        } else {
             console.error(`Failed to create activity for user ${userId}.`);
        }
    }


    // 6. Format the *final* structured data into a Discord message payload
    // Pass the final status data, previous status, and user profile
    const messagePayload = formatDiscordMessage(finalStatusData, userId, previousStatus, userProfile);
    console.log(`Formatted Discord message for user ${userId}.`);

    // 7. Always create a new message (POST)
    console.log(`Creating new Discord message in channel ${channelId} for user ${userId}...`);
    const newMessageId = await createStatusMessage(channelId, messagePayload, configInstance);
    console.log(`Discord message created. New Message ID: ${newMessageId}`);

    return newMessageId; // Return the ID of the newly created message

  } catch (error) {
    console.error(`Error during status update process for user ${userId}:`, error);
    // Re-throw the error to be handled by the calling context (e.g., interaction handler, webhook handler)
    // This allows sending appropriate feedback to the user.
    throw error; // Add more specific error context if needed
  }
}


/**
 * Apply custom emojis from user profile to status data.
 * @param {Object} statusData - Status data object from LLM processing.
 * @param {Object} customEmojis - The user's custom_emojis map { stateName: emoji }.
 * @returns {Object} - Status data object with emojis potentially replaced.
 */
function applyCustomEmojis(statusData, customEmojis) {
  // Skip if no custom emojis or empty status data
  if (!customEmojis || Object.keys(customEmojis).length === 0 || !statusData) {
    return statusData;
  }

  // Create a *deep copy* to avoid modifying the original LLM output object
  // which might be stored in history before this step.
  const updatedStatus = JSON.parse(JSON.stringify(statusData));

  // Helper to get lowercase state name for matching
  const lower = (str) => (str || '').toLowerCase();

  // Replace emoji in mood_emoji if applicable
  // Assuming 'mood' is the key for the main mood emoji in customEmojis
  if (updatedStatus.mood_emoji && customEmojis['mood']) {
      console.log(`Applying custom mood emoji: ${customEmojis['mood']}`);
      updatedStatus.mood_emoji = customEmojis['mood'];
  }

  // Replace emojis in metrics
  if (updatedStatus.metrics && Array.isArray(updatedStatus.metrics)) {
    updatedStatus.metrics = updatedStatus.metrics.map(metric => {
      const metricNameLower = lower(metric.name);
      if (customEmojis[metricNameLower]) {
        console.log(`Applying custom metric emoji for ${metricNameLower}: ${customEmojis[metricNameLower]}`);
        return { ...metric, icon: customEmojis[metricNameLower] };
      }
      return metric;
    });
  }

  // Replace emojis in personal states
  if (updatedStatus.personal_states && Array.isArray(updatedStatus.personal_states)) {
    updatedStatus.personal_states = updatedStatus.personal_states.map(state => {
      const stateNameLower = lower(state.name);
      if (customEmojis[stateNameLower]) {
         console.log(`Applying custom personal state emoji for ${stateNameLower}: ${customEmojis[stateNameLower]}`);
        return { ...state, emoji: customEmojis[stateNameLower] };
      }
      return state;
    });
  }

  return updatedStatus;
}


/**
 * Handle direct status update requests via a specific API endpoint (e.g., /update-status)
 * Useful for testing, debugging, or integration with other systems.
 * Expects a POST request with JSON body: { "statusText": "...", "userId": "..." }
 * @param {Request} request - The incoming HTTP request object.
 * @param {Object} context - The request context containing the config instance.
 * @returns {Promise<Response>} - An HTTP Response object.
 */
export async function handleDirectStatusUpdate(request, context) {
  const { config } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // Ensure content type is application/json
    if (!request.headers.get('content-type')?.includes('application/json')) {
        return new Response('Bad Request: Content-Type must be application/json', { status: 400 });
    }

    const { statusText, userId } = await request.json();

    // Validate input
    if (!statusText || typeof statusText !== 'string' || statusText.trim() === '') {
      return new Response('Bad Request: Missing or invalid "statusText" parameter.', { status: 400 });
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      // Use a default/test user ID if none provided, or return error
      // For this example, let's return an error.
      return new Response('Bad Request: Missing or invalid "userId" parameter.', { status: 400 });
      // const userId = '0'; // Or assign a default test ID
    }

    console.log(`Received direct status update request for user ${userId}`);

    // Process the update using the core function
    const messageId = await processStatusUpdate(statusText, userId, config);

    // Return a success response
    return new Response(JSON.stringify({
        success: true,
        message: 'Status updated successfully.',
        userId: userId,
        messageId: messageId
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling direct status update request:', error);
    // Return an error response
    return new Response(JSON.stringify({
        success: false,
        message: `Error updating status: ${error.message}`
    }), {
        status: 500, // Internal Server Error
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
