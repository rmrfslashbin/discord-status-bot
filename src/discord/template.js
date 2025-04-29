// src/discord/template.js - Logic for handling status templates

import { processStatusUpdate } from '../api/status.js';
import { getUserTemplates } from '../storage/kv.js'; // Only need get here

/**
 * Apply a saved status template by processing its text.
 * @param {string} userId - The Discord User ID applying the template.
 * @param {string} templateName - The name of the template to apply (case-insensitive).
 * @param {Configuration} configInstance - The application configuration instance.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<string>} - The message ID of the newly created status message.
 * @throws {Error} If the template is not found or processing fails.
 */
export async function applyStatusTemplate(userId, templateName, configInstance, kvStore) {
  if (!userId || !templateName || !configInstance || !kvStore) {
    throw new Error('Missing required arguments for applying template.');
  }

  try {
    // Get user templates from KV
    const templates = await getUserTemplates(userId, kvStore);

    // Find the requested template (case-insensitive)
    const lowerCaseName = templateName.toLowerCase();
    const template = templates.find(t => t.name.toLowerCase() === lowerCaseName);

    if (!template) {
      throw new Error(`Template "${templateName}" not found. Use \`/template list\` to see your templates.`);
    }

    console.log(`Applying template "${template.name}" for user ${userId}.`);
    // Process the template text using the main status update function
    // processStatusUpdate handles fetching context, LLM processing, storage, and posting.
    const messageId = await processStatusUpdate(template.template_text, userId, configInstance);

    return messageId; // Return the message ID of the posted status
  } catch (error) {
    console.error(`Error applying status template "${templateName}" for user ${userId}:`, error);
    // Re-throw the error to be handled by the interaction handler
    throw error;
  }
}

/**
 * Format the list of user's saved templates for display in Discord.
 * @param {string} userId - The Discord User ID whose templates are being listed.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @param {string|null} [categoryFilter=null] - Optional category to filter by.
 * @returns {Promise<Object>} - A Discord interaction response data object (embed or content).
 */
export async function formatTemplatesList(userId, kvStore, categoryFilter = null) {
  if (!userId || !kvStore) {
      return { content: "Error: Missing user ID or storage binding.", ephemeral: true };
  }

  try {
    const templates = await getUserTemplates(userId, kvStore);

    if (templates.length === 0) {
      return {
        content: "You don't have any saved status templates yet. Create one with `/template save name: <name> text: <status text>`!",
        ephemeral: true // Make ephemeral true for interaction response data
      };
    }

    // Filter by category if provided
    let filteredTemplates = templates;
    if (categoryFilter) {
        filteredTemplates = templates.filter(t => (t.category || 'Uncategorized').toLowerCase() === categoryFilter.toLowerCase());
        if (filteredTemplates.length === 0) {
             return {
                content: `You don't have any templates in the category "${categoryFilter}".`,
                ephemeral: true
            };
        }
    }

    // Group templates by category
    const groupedTemplates = filteredTemplates.reduce((acc, t) => {
        const category = t.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(t);
        return acc;
    }, {});

    // Sort categories and templates within categories
    const sortedCategories = Object.keys(groupedTemplates).sort((a, b) => a.localeCompare(b));

    let description = categoryFilter
        ? `Showing templates in category: **${categoryFilter}**\n\n`
        : `Here are your saved status templates. Use them with \`/template use name: <name>\`\n\n`;

    const fields = sortedCategories.map(category => {
        const categoryTemplates = groupedTemplates[category].sort((a, b) => a.name.localeCompare(b.name));
        const templateList = categoryTemplates.map(t =>
            `${t.emoji || '📝'} **${t.name}**` // Keep it concise for field view
            // ` - Created: <t:${Math.floor(new Date(t.created_at).getTime()/1000)}:R>` // Maybe too verbose for fields
        ).join('\n');
        return { name: category, value: templateList || '_No templates in this category._', inline: false }; // Display categories separately
    });


    return {
      embeds: [{
        title: "📋 Your Status Templates",
        description: description,
        color: 0x7289da, // Discord Blurple
        fields: fields.length > 0 ? fields : [{ name: "No Templates", value: "No templates found matching your criteria."}],
        footer: {
          text: "Manage with /template save|delete. Use /template list category:<name> to filter."
        }
      }],
      ephemeral: true // Make ephemeral true for interaction response data
    };
  } catch (error) {
    console.error(`Error formatting templates list for user ${userId}:`, error);
    return {
      content: "❌ Error retrieving your templates. Please try again later.",
      ephemeral: true // Make ephemeral true for interaction response data
    };
  }
}


// --- Placeholder functions for future export/import ---

/**
 * Placeholder: Export a specific template.
 * @param {string} userId
 * @param {string} templateName
 * @param {KVNamespace} kvStore
 * @returns {Promise<Object>} Response data (e.g., content with export code)
 */
export async function exportTemplate(userId, templateName, kvStore) {
    // TODO: Implement logic to find template and generate an exportable format (e.g., base64 JSON)
    console.warn(`exportTemplate not implemented for user ${userId}, template ${templateName}`);
    return { content: `Template export functionality is not yet implemented for "${templateName}".`, ephemeral: true };
}

/**
 * Placeholder: Import a template from an export code.
 * @param {string} userId
 * @param {string} exportCode
 * @param {KVNamespace} kvStore
 * @returns {Promise<Object>} Response data (e.g., success/error message)
 */
export async function importTemplate(userId, exportCode, kvStore) {
    // TODO: Implement logic to decode exportCode, validate, and save the template
    console.warn(`importTemplate not implemented for user ${userId}`);
    return { content: "Template import functionality is not yet implemented.", ephemeral: true };
}
