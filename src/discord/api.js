// src/discord/api.js - Discord API client functions

/**
 * Make a request to the Discord API
 * @param {string} endpoint - API endpoint path (e.g., /channels/{channel.id}/messages)
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {Configuration} configInstance - Application configuration instance
 * @param {Object} [body=null] - Request body for POST/PATCH
 * @returns {Promise<Object|null>} - Parsed JSON response or null on error
 */
async function discordApiRequest(endpoint, method, configInstance, body = null) {
    const apiBase = configInstance.getValue('discord.apiEndpoint');
    const botToken = configInstance.getValue('discord.botToken');

    if (!botToken) {
        throw new Error('Discord bot token not configured');
    }
    if (!apiBase) {
        throw new Error('Discord API endpoint not configured');
    }

    const url = `${apiBase}${endpoint}`;
    const options = {
        method: method,
        headers: {
            'Authorization': `Bot ${botToken}`,
            'User-Agent': 'DiscordStatusBot (Cloudflare Worker, v1.0)', // Identify your bot
        }
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    console.log(`Discord API Request: ${method} ${url}`);

    try {
        const response = await fetch(url, options);

        // Check for rate limits
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000; // Default to 5s
            console.warn(`Rate limited by Discord. Retrying after ${retryMs}ms...`);
            // In a real worker, you might want to defer or queue, but simple delay for example:
            await new Promise(resolve => setTimeout(resolve, retryMs));
            // Retry the request (beware of potential infinite loops without limits)
            // return discordApiRequest(endpoint, method, configInstance, body);
            // For simplicity here, we'll just throw an error after one wait.
            throw new Error(`Discord API rate limit hit. Retry after ${retryMs}ms.`);
        }

        // Attempt to parse JSON response even for non-ok statuses for error details
        let responseData = null;
        try {
            responseData = await response.json();
        } catch (e) {
            // If response is not JSON or empty
            if (!response.ok) {
                 const textResponse = await response.text();
                 throw new Error(`Discord API Error (${response.status}): ${textResponse || 'No response body'}`);
            }
            // If response was ok but not JSON (e.g., 204 No Content), return null or handle as needed
             if (response.status === 204) return null;
        }


        if (!response.ok) {
            console.error(`Discord API Error (${response.status}):`, responseData || 'No JSON body');
            const errorMessage = responseData?.message || `HTTP ${response.status}`;
            const errorCode = responseData?.code || 0;
            const error = new Error(`Discord API Error: ${errorMessage} (Code: ${errorCode})`);
            error.statusCode = response.status;
            error.errorCode = errorCode; // Attach Discord-specific error code
            error.responseData = responseData; // Attach full error details
            throw error;
        }

        return responseData; // Parsed JSON response

    } catch (error) {
        console.error(`Failed to execute Discord API request ${method} ${url}:`, error);
        // Re-throw the error to be handled by the caller
        throw error;
    }
}

// Removed updateStatusMessage function as we now always create new messages.

/**
 * Create a new status message in the specified channel.
 * @param {string} channelId - Discord channel ID
 * @param {Object} messageData - Formatted message payload (embeds, components)
 * @param {Configuration} configInstance - Application configuration instance
 * @returns {Promise<string>} - The ID of the newly created message
 */
export async function createStatusMessage(channelId, messageData, configInstance) {
     if (!channelId) {
        throw new Error('Target channel ID is required to create status message.');
    }
    try {
        const endpoint = `/channels/${channelId}/messages`;
        const responseData = await discordApiRequest(endpoint, 'POST', configInstance, messageData);

        if (!responseData || !responseData.id) {
            throw new Error('Failed to create message or response did not include an ID.');
        }

        console.log(`Successfully created new status message ${responseData.id} in channel ${channelId}`);
        return responseData.id; // Return the new message ID
    } catch (error) {
        console.error(`Error creating status message in channel ${channelId}:`, error);
        // Re-throw the error to be handled by the caller (e.g., processStatusUpdate)
        throw error;
    }
}

/**
 * Send a reply to a Discord interaction (follow-up message).
 * @param {string} interactionToken - The token from the interaction object
 * @param {Object} messageData - Message payload (content, embeds, components, flags)
 * @param {Configuration} configInstance - Application configuration instance
 * @returns {Promise<Object|null>} - Parsed JSON response or null
 */
export async function sendInteractionFollowup(interactionToken, messageData, configInstance) {
    const applicationId = configInstance.getValue('discord.applicationId');
    if (!applicationId) {
        throw new Error('Discord application ID not configured for interaction followup.');
    }
    const endpoint = `/webhooks/${applicationId}/${interactionToken}`;
    // Ensure messageData has content or embeds
    if (!messageData.content && (!messageData.embeds || messageData.embeds.length === 0)) {
        messageData.content = 'Processing complete.'; // Add default content if needed
    }
    return discordApiRequest(endpoint, 'POST', configInstance, messageData);
}

/**
 * Edit the original response to a Discord interaction.
 * @param {string} interactionToken - The token from the interaction object
 * @param {Object} messageData - Message payload (content, embeds, components)
 * @param {Configuration} configInstance - Application configuration instance
 * @returns {Promise<Object|null>} - Parsed JSON response or null
 */
export async function editInteractionResponse(interactionToken, messageData, configInstance) {
    const applicationId = configInstance.getValue('discord.applicationId');
     if (!applicationId) {
        throw new Error('Discord application ID not configured for editing interaction response.');
    }
    // Target the original message using '@original'
    const endpoint = `/webhooks/${applicationId}/${interactionToken}/messages/@original`;
    return discordApiRequest(endpoint, 'PATCH', configInstance, messageData);
}

/**
 * Send a direct message to a user.
 * @param {string} userId - The ID of the user to DM
 * @param {Object} messageData - Message payload (content, embeds, components)
 * @param {Configuration} configInstance - Application configuration instance
 * @returns {Promise<Object|null>} - Parsed JSON response of the created message or null
 */
export async function sendDirectMessage(userId, messageData, configInstance) {
    try {
        // 1. Create a DM channel with the user
        const dmChannelData = await discordApiRequest('/users/@me/channels', 'POST', configInstance, { recipient_id: userId });

        if (!dmChannelData || !dmChannelData.id) {
            throw new Error('Failed to create DM channel.');
        }
        const channelId = dmChannelData.id;

        // 2. Send the message to the created DM channel
        return await createStatusMessage(channelId, messageData, configInstance);

    } catch (error) {
        console.error(`Error sending direct message to user ${userId}:`, error);
        // Don't re-throw, just log the error, as failing to DM might not be critical
        return null;
    }
}
