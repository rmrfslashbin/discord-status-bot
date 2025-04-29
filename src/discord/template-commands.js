// src/discord/template-commands.js - Handler for /template slash commands

import { applyStatusTemplate, formatTemplatesList, exportTemplate, importTemplate } from './template.js';
import { saveStatusTemplate, deleteStatusTemplate } from '../storage/kv.js';

/**
 * Handle /template slash command interactions.
 * @param {Object} interaction - The Discord interaction object.
 * @param {Object} context - The worker context containing config instance.
 * @returns {Promise<Object>} - Interaction response data object (content or embeds).
 */
export async function handleTemplateCommand(interaction, context) {
  // Retrieve config instance from context
  const configInstance = context.config;
  // Retrieve KV store from config instance
  const kvStore = configInstance.getKvBinding();
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // Options are now nested: status -> template -> subcommand -> options
  const templateSubCommandOption = interaction.data.options?.[0]?.options?.[0];
  if (!templateSubCommandOption) {
      console.error('Could not find template subcommand option in interaction data.');
      return { content: "Error: Invalid command structure received.", ephemeral: true };
  }

  const subcommand = templateSubCommandOption.name;
  const options = templateSubCommandOption.options || []; // Get the actual options for the subcommand

  if (!userId) {
      return { content: "Error: Could not identify user.", ephemeral: true };
  }
   if (!kvStore) {
       console.error(`handleTemplateCommand: KV Store not available for user ${userId}.`);
       return { content: "Error: Storage service is unavailable.", ephemeral: true };
   }

  console.log(`Processing /template ${subcommand} for user ${userId}`);

  try {
      switch (subcommand) {
          case 'list': {
              // Handle optional category filter for list
              const categoryFilter = options.find(opt => opt.name === 'category')?.value;
              return await formatTemplatesList(userId, kvStore, categoryFilter);
          }

          case 'use': {
              const templateName = options.find(opt => opt.name === 'name')?.value;
              if (!templateName) return { content: "Error: Template name is required.", ephemeral: true };

              // Pass configInstance and kvStore to applyStatusTemplate
              const messageId = await applyStatusTemplate(userId, templateName, configInstance, kvStore);
              // Success message for the user who invoked the command
              return {
                  content: `✅ Status updated using template "${templateName}"! (Message ID: ${messageId})`,
                  ephemeral: true
              };
          }

          case 'save': {
              const name = options.find(opt => opt.name === 'name')?.value;
              const text = options.find(opt => opt.name === 'text')?.value;
              const emoji = options.find(opt => opt.name === 'emoji')?.value;
              const category = options.find(opt => opt.name === 'category')?.value; // Get category
              if (!name || !text) return { content: "Error: Template name and text are required.", ephemeral: true };

              // Pass category to saveStatusTemplate
              const success = await saveStatusTemplate(userId, name, text, kvStore, emoji, category);
              if (success) {
                  return { content: `✅ Template "${name}" saved successfully! ${category ? `(Category: ${category})` : ''}`, ephemeral: true };
              } else {
                  return { content: `❌ Error saving template "${name}". Please try again.`, ephemeral: true };
              }
          }

          case 'delete': {
              const templateToDelete = options.find(opt => opt.name === 'name')?.value;
              if (!templateToDelete) return { content: "Error: Template name is required.", ephemeral: true };

              // Pass kvStore to deleteStatusTemplate
              const success = await deleteStatusTemplate(userId, templateToDelete, kvStore);
               if (success) {
                  // Check if it actually existed might require returning more info from deleteStatusTemplate
                  // For now, assume success means it's gone or wasn't there.
                  return { content: `🗑️ Template "${templateToDelete}" deleted successfully (or it didn't exist).`, ephemeral: true };
              } else {
                  return { content: `❌ Error deleting template "${templateToDelete}". Please try again.`, ephemeral: true };
              }
          }
          // TODO: Add export/import back if needed, adjusting option access like above
          // case 'export': { ... }
          // case 'import': { ... }

          default:
              console.warn(`Unknown template subcommand: ${subcommand}`);
              return { content: "Unknown template command.", ephemeral: true };
      }
  } catch (error) {
      console.error(`Error handling /template ${subcommand} for user ${userId}:`, error);
      // Return specific error message from applyStatusTemplate if available
      return { content: `❌ Error: ${error.message || 'An unexpected error occurred.'}`, ephemeral: true };
  }
}
