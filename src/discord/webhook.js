// src/discord/webhook.js - Discord webhook handler (primarily for Direct Messages)

import { processStatusUpdate } from '../api/status.js';
import { sendDirectMessage } from './api.js'; // To send confirmation replies

/**
 * Handle incoming Discord webhook events (e.g., Direct Messages to the bot)
 * @param {Request} request - The incoming request object
 * @param {Object} context - The request context containing config instance
 * @returns {Promise<Response>} - The response to send back (usually just 2xx ACK)
 */
export async function handleDiscordWebhook(request, context) {
  const { config } = context;

  // Security: In a real application, you might want to verify if the webhook
  // request genuinely comes from a trusted source (e.g., using a secret path or header).
  // However, Discord doesn't typically send verifiable webhooks for DMs this way.
  // The primary security is that the bot token is needed to *act* on the message.

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await request.json();

    // Log the type of event received (useful for debugging)
    // Discord sends various events; we're interested in MESSAGE_CREATE
    // console.log('Webhook payload received:', JSON.stringify(payload).substring(0, 200) + '...'); // Log snippet

    // --- Process Direct Messages (DMs) ---
    // Check if it's a message creation event and a DM channel
    // Note: Discord API v10 uses `channel.type` for DMs. Older versions might differ.
    // DM channel type is typically 1. Check Discord docs for current types.
    // GUILD_TEXT = 0, DM = 1, GUILD_VOICE = 2, GROUP_DM = 3, etc.
    if (payload.type === 'MESSAGE_CREATE' && payload.channel?.type === 1) {
        const message = payload; // Assuming payload structure matches MESSAGE_CREATE

        // Ignore messages from bots (including our own) to prevent loops
        if (message.author?.bot) {
            console.log('Ignoring message from bot.');
            return new Response('OK (Bot message ignored)', { status: 200 });
        }

        // Extract necessary information
        const statusText = message.content?.trim();
        const userId = message.author?.id;
        const channelId = message.channel_id; // DM channel ID for potential replies

        if (!userId) {
            console.error('Webhook: Could not determine User ID from DM.');
            return new Response('Error: Could not identify user', { status: 400 });
        }
        if (!statusText) {
            console.log(`Webhook: Empty message received from user ${userId}.`);
            // Optionally send a help message back using ctx.waitUntil
            context.ctx.waitUntil(sendDirectMessage(userId, { content: 'Please provide your status update text.' }, config));
            return new Response('OK (Empty message)', { status: 200 });
        }

        console.log(`Processing DM status update from user ${userId}`);

        // Process the status update asynchronously using ctx.waitUntil
        context.ctx.waitUntil(
            processStatusUpdate(statusText, userId, config)
            .then(async (messageId) => {
                console.log(`DM status update processed for user ${userId}, message ID: ${messageId}`);
                // Send a confirmation DM back to the user
                await sendDirectMessage(userId, {
                    content: `✅ Your status dashboard has been updated! You can view it in the designated channel.`
                    // Optionally include a link to the message if possible/desired
                }, config);
            })
            .catch(async (error) => {
                console.error(`Error processing DM status update for user ${userId}:`, error);
                // Send an error DM back to the user
                await sendDirectMessage(userId, {
                    content: `❌ There was an error updating your status: ${error.message}`
                }, config);
            })
        );

        // Acknowledge the webhook immediately
        return new Response('OK (DM processing initiated)', { status: 200 });

    } else {
        // Log other event types if needed for debugging
        if (payload.type !== 'MESSAGE_CREATE') {
             console.log(`Webhook: Received non-MESSAGE_CREATE event type: ${payload.type || 'unknown'}`);
        } else if (payload.channel?.type !== 1) {
             console.log(`Webhook: Received message in non-DM channel type: ${payload.channel?.type}`);
        }
        // Acknowledge other types of webhooks without processing
        return new Response('OK (Webhook received but not processed)', { status: 200 });
    }

  } catch (error) {
    console.error('Error processing webhook payload:', error);
    return new Response(`Error processing webhook: ${error.message}`, { status: 500 });
  }
}
