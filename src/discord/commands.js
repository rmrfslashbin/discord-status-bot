// src/discord/commands.js - Slash command definitions

// src/discord/commands.js - Slash command definitions

// Command handlers are imported and routed in interactions.js

// Command definitions to be registered with Discord
export const commandDefinitions = [
  {
    name: 'status',
    description: 'Manage your status dashboard, templates, profile, and emojis',
    options: [
      {
        name: 'update',
        description: 'Update your status using free-form text',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'text',
            description: 'Describe your current status, mood, and availability',
            type: 3, // STRING
            required: true
          }
        ]
      },
      // --- Template Subcommand Group ---
      {
        name: 'template',
        description: 'Manage and use your status templates',
        type: 2, // SUB_COMMAND_GROUP
        options: [ // Subcommands of the 'template' group go here
          {
            name: 'list',
            description: 'List your saved status templates',
            type: 1, // SUB_COMMAND
            options: [ // Options for 'list' subcommand
                {
                    name: 'category',
                    description: 'Filter templates by a specific category',
                    type: 3, // STRING
                    required: false
                }
            ]
          },
          {
            name: 'use',
            description: 'Update your status using a saved template',
            type: 1, // SUB_COMMAND
            options: [ // Options for 'use' subcommand
              {
                name: 'name',
                description: 'Name of the template to use',
                type: 3, // STRING
                required: true,
                // Add autocomplete: true here if you implement autocomplete later
              }
            ]
          },
          {
            name: 'save',
            description: 'Save or update a status template',
            type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Name for this template (e.g., "Working", "Gaming Night")',
            type: 3, // STRING
            required: true
          },
          {
            name: 'text',
            description: 'The status text content for this template',
            type: 3, // STRING
            required: true
          },
          {
            name: 'emoji',
            description: 'Optional emoji to represent this template (e.g., 💼, 🎮)',
            type: 3, // STRING
            required: false
          },
          { // Add category option
            name: 'category',
            description: 'Optional category for organizing templates (e.g., Work, Personal)',
            type: 3, // STRING
            required: false
          }
        ]
      },
      {
        name: 'delete',
        description: 'Delete a saved template',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Name of the template to delete',
            type: 3, // STRING
            required: true
             // Add autocomplete: true here if you implement autocomplete later
          }
        ]
      }
      // End template group options
    ]
  },
  // --- Profile Subcommand Group ---
  {
      name: 'profile',
      description: 'View and manage your user profile settings',
      type: 2, // SUB_COMMAND_GROUP
      options: [
          {
              name: 'view',
              description: 'View your current profile settings',
              type: 1 // SUB_COMMAND
          },
          {
              name: 'timezone',
              description: 'Set your preferred timezone (e.g., America/New_York)',
              type: 1, // SUB_COMMAND
              options: [
                  {
                      name: 'value',
                      description: 'Your timezone identifier',
                      type: 3, // STRING
                      required: true
                      // Add autocomplete later?
                  }
              ]
          },
          {
              name: 'theme',
              description: 'Set your default status theme',
              type: 1, // SUB_COMMAND
              options: [
                  {
                      name: 'value',
                      description: 'Theme name (e.g., work, gaming, default)',
                      type: 3, // STRING
                      required: true,
                      choices: [ // Provide choices based on themes.js
                          { name: 'Default', value: 'default' },
                          { name: 'Work', value: 'work' },
                          { name: 'Gaming', value: 'gaming' },
                          { name: 'Social', value: 'social' },
                          { name: 'Rest', value: 'rest' },
                          { name: 'Creative', value: 'creative' },
                          { name: 'Learning', value: 'learning' },
                      ]
                  }
              ]
          },
          {
              name: 'visibility',
              description: 'Set your profile visibility (future use)',
              type: 1, // SUB_COMMAND
              options: [
                  {
                      name: 'value',
                      description: 'Visibility setting',
                      type: 3, // STRING
                      required: true,
                      choices: [
                          { name: 'Public', value: 'public' },
                          { name: 'Private', value: 'private' }
                      ]
                  }
              ]
          }
      // End profile group options
      ]
  },
  // --- Emoji Subcommand Group ---
  {
    name: 'emoji',
    description: 'Manage your custom emojis for status indicators',
    type: 2, // SUB_COMMAND_GROUP
    options: [
      {
        name: 'list',
        description: 'List your custom emojis',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'set',
        description: 'Set a custom emoji for a status indicator',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'state',
            description: 'Status indicator to customize (e.g., energy, mood, hunger)',
            type: 3, // STRING
            required: true
            // Add autocomplete later?
          },
          {
            name: 'emoji',
            description: 'Emoji to use (standard emojis recommended)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'reset',
        description: 'Reset a custom emoji to default',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'state',
            description: 'Status indicator to reset',
            type: 3, // STRING
            required: true
            // Add autocomplete later?
          }
        ]
      }
    // End emoji group options
    ]
  },
  // --- Utility Subcommands ---
  {
      name: 'health',
      description: 'Check the bot\'s operational status and version.',
      type: 1 // SUB_COMMAND
      // No options needed
  },
  {
      name: 'purge',
      description: 'Delete all your stored data (history, profile, templates, etc.). IRREVERSIBLE!',
      type: 1, // SUB_COMMAND
      options: [
          {
              // Note: This is now an *option* of the 'purge' subcommand, not a subcommand itself.
              // We'll check for its presence in the handler.
              name: 'confirm',
              description: 'Set to true to confirm deletion. THIS IS IRREVERSIBLE.',
              type: 5, // BOOLEAN
              required: true // Require confirmation explicitly
          }
      ]
  },
  {
      name: 'info',
      description: 'Display information about the bot and available commands.',
      type: 1 // SUB_COMMAND
      // No options needed
  }
  // End top-level /status options
  ]
}];

// Command handlers are imported and routed in interactions.js
