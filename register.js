
import dotenv from 'dotenv';
import process from 'node:process';
// Import the command definitions from the source file
// Ensure this path is correct relative to your project root
import { commandDefinitions } from './src/discord/commands.js';

/**
 * This file is meant to be run from the command line, and is not used by the
 * application server. It's allowed to use node.js primitives, and only needs
 * to be run once to register the slash commands.
 */

// Load environment variables from .dev.vars file (if it exists)
// Useful for local development without setting system-wide environment variables
dotenv.config({ path: '.dev.vars' });

// Command definitions are now imported from src/discord/commands.js
// const STATUS_COMMAND = { ... }; // Removed hardcoded command

// Get required environment variables
const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token) {
  throw new Error('The DISCORD_BOT_TOKEN environment variable is required.');
}
if (!applicationId) {
  throw new Error(
    'The DISCORD_APPLICATION_ID environment variable is required.',
  );
}

// Construct the Discord API URL for registering commands
const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

// Register all commands defined in commandDefinitions
console.log(`Registering ${commandDefinitions.length} commands...`);
const response = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bot ${token}`,
  },
  method: 'PUT',
  // Send the imported command definitions array
  body: JSON.stringify(commandDefinitions),
});

if (response.ok) {
  console.log('Registered commands successfully!');
  const data = await response.json();
  console.log('Registered commands details:');
  console.log(JSON.stringify(data, null, 2));
} else {
  console.error('Error registering commands:');
  let errorText = `Error: ${response.status} ${response.statusText}`;
  try {
    const error = await response.json(); // Try to parse JSON error response
    console.error('API Error Details:', JSON.stringify(error, null, 2));
    errorText = `${errorText}\n${JSON.stringify(error)}`;
  } catch (err) {
    // If response is not JSON
    const textError = await response.text();
    console.error('API Error Text:', textError);
    errorText = `${errorText}\n${textError}`;
  }
  console.error(errorText);
  process.exit(1); // Exit with error code
}
