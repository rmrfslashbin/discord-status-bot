// src/discord/interactions.js - Discord interactions handler (slash commands, buttons)

import { verifyDiscordRequest } from './verify.js';
import { processStatusUpdate } from '../api/status.js';
import { sendInteractionFollowup, editInteractionResponse, sendDirectMessage } from './api.js';
// Import command handlers
import { handleTemplateCommand } from './template-commands.js';
import { handleProfileCommand } from './profile.js';
import { handleEmojiCommand } from './emoji.js';
import { handleHealthCommand, handlePurgeCommand, handleInfoCommand } from './utility-commands.js'; // Import new handlers
// Import the component interaction handler
import { handleComponentInteraction } from './components.js';

// Discord interaction types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3, // Buttons, Select Menus
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

// Discord interaction response types
export const InteractionResponseType = {
  PONG: 1, // ACK a Ping
  CHANNEL_MESSAGE_WITH_SOURCE: 4, // Respond to interaction with message
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5, // ACK interaction and edit later, user sees "thinking..."
  DEFERRED_UPDATE_MESSAGE: 6, // ACK component interaction and edit later, user sees no loading state
  UPDATE_MESSAGE: 7, // Edit the message the component was attached to
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9, // Respond with a modal popup
};

/**
 * Handle incoming Discord interactions requests (/interactions endpoint)
 * @param {Request} request - The incoming request object
 * @param {Object} context - The request context containing config instance
 * @returns {Promise<Response>} - The response to send back to Discord
 */
export async function handleDiscordInteractions(request, context) {
  const { config } = context;
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text(); // Read body as text for verification

  // Verify the request signature
  const isValidRequest = await verifyDiscordRequest(body, signature, timestamp, config.getValue('discord.publicKey'));
  if (!isValidRequest) {
    console.error('Invalid Discord interaction signature');
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(body);

  try {
    // Handle different interaction types
    switch (interaction.type) {
      case InteractionType.PING:
        // Handle Discord's verification ping
        console.log('Handling Discord Ping');
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case InteractionType.APPLICATION_COMMAND:
        // Handle slash commands
        console.log('Handling Application Command');
        // Pass the handlerContext created in index.js
        return await handleSlashCommand(interaction, context);

      case InteractionType.MESSAGE_COMPONENT:
        // Handle button clicks, select menus, etc.
        console.log('Handling Message Component');
        // Pass the handlerContext created in index.js
        // Determine the action *before* calling the main handler
        const customId = interaction.data.custom_id;
        const [action] = customId.split(':');

        // --- Handle DEFERRED_UPDATE_MESSAGE for specific actions ---
        // Actions like 'react' or 'join_activity' that update the original message
        // should usually be deferred first.
        if (action === 'react' || action === 'join_activity') {
             const deferredResponse = new Response(JSON.stringify({
                type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
             }), { headers: { 'Content-Type': 'application/json' } });

             // Process the actual logic asynchronously
             context.ctx.waitUntil(
                 handleComponentInteraction(interaction, context)
                    .catch(async (error) => {
                        // Generic error handling if the handler itself throws unexpectedly
                        console.error(`Unhandled error in deferred component interaction (${action}):`, error);
                        try {
                            await editInteractionResponse(interaction.token, {
                                content: `❌ An unexpected error occurred while processing '${action}'.`,
                                ephemeral: true
                            }, config);
                        } catch (editError) {
                             console.error(`Failed to send error edit for deferred component interaction (${action}):`, editError);
                        }
                    })
             );
             return deferredResponse; // Return the ACK immediately
        }
        // --- End DEFERRED_UPDATE_MESSAGE handling ---

        // --- Handle other component interactions directly ---
        // Actions like 'show_details' or 'check_in' respond ephemerally or with followups
        const componentResponseData = await handleComponentInteraction(interaction, context);

        // Determine response type (usually CHANNEL_MESSAGE_WITH_SOURCE for ephemeral)
        // handleComponentInteraction now returns the data payload directly for these cases
        return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: componentResponseData // Expecting { content: ..., ephemeral: true } or { embeds: [...], ephemeral: true }
        }), { headers: { 'Content-Type': 'application/json' } });


      // Add cases for AUTOCOMPLETE or MODAL_SUBMIT if needed later
      // case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE:
      //   console.log('Handling Autocomplete');
      //   return handleAutocomplete(interaction, context);
      // case InteractionType.MODAL_SUBMIT:
      //   console.log('Handling Modal Submit');
      //   return handleModalSubmit(interaction, context);

      default:
        console.warn(`Unhandled interaction type: ${interaction.type}`);
        // Provide a generic acknowledgement for unhandled types
        return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'This interaction type is not handled yet.', flags: 64 } // Ephemeral
        }), { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
      console.error('Error handling interaction:', error);
      // Attempt to send an ephemeral error message back to the user if possible
      // This might fail if a response was already sent or the token expired
      try {
          if (interaction.token) {
              await sendInteractionFollowup(interaction.token, {
                  content: `An error occurred while processing your request: ${error.message}`,
                  flags: 64 // Ephemeral
              }, config);
          }
      } catch (followupError) {
          console.error('Failed to send error followup message:', followupError);
      }
      // Return a generic server error response
      return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle slash command interactions
 * @param {Object} interaction - The interaction object
 * @param {Object} context - The request context
 * @returns {Promise<Response>} - The response to send back to Discord
 */
async function handleSlashCommand(interaction, context) {
  const { config } = context;
  const { data: commandData } = interaction; // Destructure data
  const commandName = commandData.name; // Will always be 'status' now
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!userId) {
      console.error('Could not determine User ID from interaction.');
      // Respond ephemerally if possible
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Error: Could not identify user.', flags: 64 }
      }), { headers: { 'Content-Type': 'application/json' } });
  }

  // --- Determine the actual command/group being invoked ---
  const topLevelOption = commandData.options?.[0]; // This is the subcommand or group
  if (!topLevelOption) {
      console.error('No subcommand or group specified for /status command.');
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Error: Please specify a subcommand (e.g., update, template, profile).', flags: 64 }
      }), { headers: { 'Content-Type': 'application/json' } });
  }

  const subCommandOrGroupName = topLevelOption.name;
  console.log(`Processing /status command with subcommand/group "${subCommandOrGroupName}" for user ${userId}`);

  // --- Route based on the subcommand/group ---

  // Direct subcommands of /status
  if (subCommandOrGroupName === 'update') {
      const statusTextOption = topLevelOption.options?.find(opt => opt.name === 'text');
      const statusText = statusTextOption?.value;

      if (!statusText || typeof statusText !== 'string') {
          return new Response(JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'Error: Status text is required.', flags: 64 } // Ephemeral
          }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Acknowledge the interaction immediately (DEFERRED)
      // This tells Discord "I got it, I'm working on it"
      const deferredResponse = new Response(JSON.stringify({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: 64 } // Make the "thinking..." message ephemeral
      }), { headers: { 'Content-Type': 'application/json' } });

      // Process the status update asynchronously *after* responding
      // Use ctx.waitUntil from the handlerContext
      context.ctx.waitUntil(
        processStatusUpdate(statusText, userId, config)
          .then(async (messageId) => {
            console.log(`Status update processed for user ${userId}, message ID: ${messageId}`);
            // Edit the original deferred response to show success
            await editInteractionResponse(interaction.token, {
              content: `✅ Your status dashboard has been updated! (Message ID: ${messageId})`,
              // Optionally add components or embeds here if needed
            }, config);
          })
          .catch(async (error) => {
            console.error(`Error processing status update for user ${userId}:`, error);
            // Edit the original deferred response to show the error
            await editInteractionResponse(interaction.token, {
              content: `❌ Error updating status: ${error.message}`,
            }, config);
          })
      );

      return deferredResponse; // Return the deferred response immediately

  } else if (subCommandOrGroupName === 'health') {
      // Health command is fast, handle directly
      const responseData = await handleHealthCommand(interaction, context);
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: responseData // Expecting { content: ..., ephemeral: true }
      }), { headers: { 'Content-Type': 'application/json' } });

  } else if (subCommandOrGroupName === 'purge') {
      // Purge now requires a boolean 'confirm' option
      // Defer the response as purging can take time
      const deferredResponse = new Response(JSON.stringify({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: 64 } // Ephemeral thinking message
      }), { headers: { 'Content-Type': 'application/json' } });

      // Process purge asynchronously
      context.ctx.waitUntil(
          handlePurgeCommand(interaction, context) // Pass the whole context
              .then(async (responseData) => {
                  // Edit the original deferred response with the result
                  await editInteractionResponse(interaction.token, responseData, config);
              })
              .catch(async (error) => {
                  // Should not happen often as handlePurgeCommand catches errors, but just in case
                  console.error(`Unhandled error in deferred purge command handler for user ${userId}:`, error);
                  await editInteractionResponse(interaction.token, {
                      content: `❌ An unexpected error occurred during purge: ${error.message}`,
                      ephemeral: true
                  }, config);
              })
      );
      return deferredResponse; // Return ACK immediately

  } else if (subCommandOrGroupName === 'info') {
      // Info command is fast, handle directly
      const responseData = await handleInfoCommand(interaction, context);
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: responseData // Expecting { embeds: [...], ephemeral: true }
      }), { headers: { 'Content-Type': 'application/json' } });

  // --- Subcommand Groups ---
  } else if (subCommandOrGroupName === 'template') {
      // Determine the actual template subcommand (list, use, save, delete)
      const templateSubCommand = topLevelOption.options?.[0];
      if (!templateSubCommand) {
          // Handle case where group is invoked without subcommand (shouldn't happen with required subcommands)
          return new Response(JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'Error: Please specify a template action (list, use, save, delete).', flags: 64 }
          }), { headers: { 'Content-Type': 'application/json' } });
      }
      const templateAction = templateSubCommand.name;

      // Use DEFERRED for the 'use' command as it involves LLM processing
      if (templateAction === 'use') {
          const deferredResponse = new Response(JSON.stringify({
              type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
              data: { flags: 64 } // Ephemeral thinking message
          }), { headers: { 'Content-Type': 'application/json' } });

          context.ctx.waitUntil(
              handleTemplateCommand(interaction, context) // Pass the whole context
                  .then(async (responseData) => {
                      await editInteractionResponse(interaction.token, responseData, config);
                  })
                  .catch(async (error) => {
                      console.error(`Error in deferred template command handler for user ${userId}:`, error);
                      await editInteractionResponse(interaction.token, {
                          content: `❌ Error processing template command: ${error.message}`,
                          ephemeral: true
                      }, config);
                  })
          );
          return deferredResponse;
      } else {
          // For list, save, delete - handle directly and respond
          const responseData = await handleTemplateCommand(interaction, context);
          return new Response(JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: responseData
          }), { headers: { 'Content-Type': 'application/json' } });
      }
  } else if (subCommandOrGroupName === 'profile') {
      // Profile commands are generally fast, handle directly
      const responseData = await handleProfileCommand(interaction, context);
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: responseData
      }), { headers: { 'Content-Type': 'application/json' } });

  } else if (subCommandOrGroupName === 'emoji') {
      // Emoji commands are also fast, handle directly
      const responseData = await handleEmojiCommand(interaction, context);
      return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: responseData
      }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Fallback for unknown subcommands/groups
  console.warn(`Unknown /status subcommand/group received: ${subCommandOrGroupName}`);
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Unknown command received.', flags: 64 } // Ephemeral
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Removed local handleComponentInteraction function definition.
// The handler is now imported from src/discord/components.js and used in handleDiscordInteractions.

// Note: updateInteractionResponse was refactored into editInteractionResponse and sendInteractionFollowup in api.js
// Note: verifyDiscordRequest is now imported from verify.js
