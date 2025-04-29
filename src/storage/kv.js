// src/storage/kv.js - KV storage operations for user status

/**
 * Get the KV binding instance from the configuration.
 * Assumes the binding is stored and accessible via the config instance.
 * @param {Configuration} configInstance - The application configuration instance.
 * @returns {KVNamespace | null} - The KV Namespace binding or null if not found.
 */
// Removed getKvStore helper function. KV binding will be passed directly.


/**
 * Store user status in history and update the latest status reference.
 * @param {string} userId - Discord user ID.
 * @param {string} rawInput - Original status text provided by the user.
 * @param {Object} processedStatus - The structured status object returned by the LLM.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @param {number} historyLimit - Maximum number of history entries to keep.
 * @returns {Promise<Object|null>} - The newly stored status entry, or null on error.
 */
export async function storeUserStatus(userId, rawInput, processedStatus, kvStore, historyLimit = 20) {
  // Use passed kvStore directly
  if (!userId || !processedStatus || !kvStore) {
    console.error('storeUserStatus: Missing userId, processedStatus, or kvStore binding.');
    return null;
  }

  try {
    // Define keys
    const historyKey = `user:${userId}:status_history`;
    const latestKey = `user:${userId}:latest_status`;

    // Get existing history
    let historyData = await kvStore.get(historyKey, { type: 'json' });
    let history = (historyData && Array.isArray(historyData.history)) ? historyData.history : [];

    // Create new status entry
    const newStatusEntry = {
      timestamp: new Date().toISOString(),
      raw_input: rawInput,
      processed_status: processedStatus // Store the LLM output object directly
    };

    // Add to history
    history.push(newStatusEntry);

    // Trim history if needed
    if (historyLimit > 0 && history.length > historyLimit) {
      history = history.slice(history.length - historyLimit);
    }

    // Store updated history (use ctx.waitUntil for non-blocking storage)
    // Note: waitUntil is typically available in the main fetch handler context (ctx),
    // might need to be passed down or handled differently depending on execution context.
    // For simplicity here, we await directly. Consider performance implications.
    await kvStore.put(historyKey, JSON.stringify({ history }));
    console.log(`Stored status history for user ${userId}. History length: ${history.length}`);

    // Update latest status reference
    await kvStore.put(latestKey, JSON.stringify(newStatusEntry));
    console.log(`Updated latest status reference for user ${userId}.`);

    return newStatusEntry;
  } catch (error) {
    console.error(`KV Error storing user status for ${userId}:`, error);
    return null;
  }
}

/**
 * Get the user's status history from KV storage.
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @param {number} limit - Max number of entries to return (0 = all from stored history).
 * @returns {Promise<Array>} - Array of status history entries (newest last).
 */
export async function getUserStatusHistory(userId, kvStore, limit = 0) {
   // Use passed kvStore directly
   if (!userId || !kvStore) {
    console.error('getUserStatusHistory: Missing userId or kvStore binding.');
    return [];
  }

  const key = `user:${userId}:status_history`;

  try {
    const data = await kvStore.get(key, { type: 'json' });

    if (!data || !Array.isArray(data.history)) {
      console.log(`No status history found in KV for user ${userId} (key: ${key}).`);
      return [];
    }

    let history = data.history;

    // Apply limit if specified (retrieve from the end of the array)
    if (limit > 0 && history.length > limit) {
      history = history.slice(history.length - limit);
    }

    console.log(`Retrieved ${history.length} status history entries for user ${userId}.`);
    return history;
  } catch (error) {
    console.error(`KV Error retrieving status history for user ${userId} (key: ${key}):`, error);
    return [];
  }
}

/**
 * Get the user's most recent status entry from KV storage.
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object|null>} - The latest status entry object, or null if not found or error.
 */
export async function getLatestUserStatus(userId, kvStore) {
   // Use passed kvStore directly
   console.log(`[getLatestUserStatus] Received kvStore type: ${typeof kvStore}`); // Add this log
   if (!userId || !kvStore) {
    console.error('getLatestUserStatus: Missing userId or kvStore binding.');
    return null;
  }

  const key = `user:${userId}:latest_status`;

  try {
    // Retrieve the data, expecting JSON
    const data = await kvStore.get(key, { type: 'json' });

    if (data) {
      console.log(`Retrieved latest status for user ${userId} from KV (key: ${key}). Timestamp: ${data.timestamp}`);
    } else {
      console.log(`No latest status found in KV for user ${userId} (key: ${key}).`);
    }
    return data || null; // Returns the parsed JSON object or null
  } catch (error) {
    console.error(`KV Error retrieving latest status for user ${userId} (key: ${key}):`, error);
    return null; // Return null on error
  }
}


// --- Template Storage Functions ---

/**
 * Get user's saved status templates from KV storage.
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Array>} - Array of template objects, or empty array on error/not found.
 */
export async function getUserTemplates(userId, kvStore) {
  if (!userId || !kvStore) {
    console.error('getUserTemplates: Missing userId or kvStore binding.');
    return [];
  }
  const key = `user:${userId}:templates`;

  try {
    const data = await kvStore.get(key, { type: 'json' });
    const templates = (data && Array.isArray(data.templates)) ? data.templates : [];
    console.log(`Retrieved ${templates.length} templates for user ${userId}.`);
    return templates;
  } catch (error) {
    console.error(`KV Error retrieving templates for user ${userId} (key: ${key}):`, error);
    return [];
  }
}

/**
 * Save or update a status template for a user in KV storage.
 * @param {string} userId - Discord user ID.
 * @param {string} templateName - Name of the template (case-insensitive comparison).
 * @param {string} templateText - The status text content of the template.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @param {string} [emoji="📝"] - Optional emoji for the template.
 * @param {string|null} [category=null] - Optional category for the template.
 * @returns {Promise<boolean>} - True if saving succeeded, false otherwise.
 */
export async function saveStatusTemplate(userId, templateName, templateText, kvStore, emoji = "📝", category = null) {
  if (!userId || !templateName || !templateText || !kvStore) {
    console.error('saveStatusTemplate: Missing userId, templateName, templateText, or kvStore binding.');
    return false;
  }
  const key = `user:${userId}:templates`;

  try {
    // Get existing templates
    const data = await kvStore.get(key, { type: 'json' });
    let templates = (data && Array.isArray(data.templates)) ? data.templates : [];

    // Prepare the new/updated template object
    const template = {
      name: templateName, // Store with original casing
      emoji: emoji,
      category: category || null, // Store category, default to null
      template_text: templateText,
      updated_at: new Date().toISOString() // Use updated_at
    };

    // Find if template exists (case-insensitive) and update or add
    const lowerCaseName = templateName.toLowerCase();
    const existingIndex = templates.findIndex(t => t.name.toLowerCase() === lowerCaseName);

    if (existingIndex >= 0) {
      // Preserve original created_at if updating
      template.created_at = templates[existingIndex].created_at || template.updated_at;
      templates[existingIndex] = template; // Update existing
      console.log(`Updated template "${templateName}" for user ${userId}.`);
    } else {
      template.created_at = template.updated_at; // Set created_at for new template
      templates.push(template); // Add new
      console.log(`Added new template "${templateName}" for user ${userId}.`);
    }

    // Store the updated list
    console.log(`KV PUT: Storing templates for key: ${key}`);
    await kvStore.put(key, JSON.stringify({ templates }));
    return true;
  } catch (error) {
    console.error(`KV Error saving template "${templateName}" for user ${userId} (key: ${key}):`, error);
    return false;
  }
}

/**
 * Purge all data associated with a specific user ID from KV storage.
 * This includes status history, latest status, templates, profile, and interaction logs.
 * @param {string} userId - The Discord user ID whose data should be purged.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<number>} - The number of keys successfully deleted.
 * @throws {Error} If listing or deletion fails.
 */
export async function purgeUserData(userId, kvStore) {
    if (!userId || !kvStore) {
        throw new Error('Missing userId or kvStore binding for purgeUserData.');
    }

    // Define key prefixes associated with the user
    const keyPrefixes = [
        `user:${userId}:`,      // Covers status_history, latest_status, templates, activities (if added later)
        `profile:${userId}`,    // Covers profile settings and custom emojis
        `log:interactions:${userId}` // Covers interaction logs for this user
        // Add other prefixes if user data is stored elsewhere
    ];

    let deletedCount = 0;
    const activityKeysToDelete = []; // Array to hold activity keys created by this user
    console.log(`Starting data purge for user ${userId}...`);

    try {
        // --- Step 1: Identify activities created by the user ---
        console.log("Identifying activities created by user...");
        let activityListComplete = false;
        let activityCursor = undefined;
        while (!activityListComplete) {
            const listResult = await kvStore.list({ prefix: 'activity:', cursor: activityCursor, limit: 100 });
            console.log(`[purgeUserData] List result for prefix "activity:":`, JSON.stringify(listResult));

            for (const key of listResult.keys) {
                try {
                    const activityData = await kvStore.get(key.name, { type: 'json' });
                    if (activityData && activityData.creator === userId) {
                        console.log(`Found activity ${key.name} created by user ${userId}. Marking for deletion.`);
                        activityKeysToDelete.push(key.name);
                    }
                } catch (getError) {
                    console.error(`Error getting activity data for key ${key.name} during purge:`, getError);
                }
            }

            if (listResult.list_complete) {
                activityListComplete = true;
            } else {
                activityCursor = listResult.cursor;
            }
        }
        console.log(`Identified ${activityKeysToDelete.length} activities created by user ${userId} for deletion.`);

        // --- Step 2: Delete user-specific prefixed keys ---
        for (const prefix of keyPrefixes) {
            console.log(`Listing keys with prefix: ${prefix}`);
            let listComplete = false;
            let cursor = undefined;
            // Remove batching logic for deletion
            // let keysToDeleteInBatch = [];

            while (!listComplete) {
                const listResult = await kvStore.list({ prefix: prefix, cursor: cursor, limit: 100 }); // List in batches
                console.log(`[purgeUserData] List result for prefix "${prefix}":`, JSON.stringify(listResult)); // Log list result

                const keys = listResult.keys.map(k => k.name);

                if (keys.length > 0) {
                    console.log(`Found ${keys.length} keys to delete with prefix ${prefix} in this batch.`);
                    // Delete keys one by one
                    for (const keyToDelete of keys) {
                        console.log(`Attempting to delete key: ${keyToDelete}`);
                        try {
                            await kvStore.delete(keyToDelete);
                            console.log(`kvStore.delete call completed for key: ${keyToDelete}`);
                            deletedCount++;
                        } catch (deleteError) {
                             console.error(`Error deleting key ${keyToDelete}:`, deleteError);
                             // Optionally re-throw or collect errors
                        }
                    }
                }

                // Prepare for next batch or finish
                if (listResult.list_complete) {
                    listComplete = true;
                } else {
                    cursor = listResult.cursor;
                }

            }
        } // End for...of loop for user-specific prefixes

        // --- Step 3: Delete identified activity keys ---
        if (activityKeysToDelete.length > 0) {
             console.log(`Attempting to delete ${activityKeysToDelete.length} identified activity keys...`);
             for (const keyToDelete of activityKeysToDelete) {
                 console.log(`Attempting to delete activity key: ${keyToDelete}`);
                 try {
                     await kvStore.delete(keyToDelete);
                     console.log(`kvStore.delete call completed for activity key: ${keyToDelete}`);
                     deletedCount++;
                 } catch (deleteError) {
                      console.error(`Error deleting activity key ${keyToDelete}:`, deleteError);
                 }
             }
        } // End if block for activity keys
    // <<< REMOVE the incorrectly placed closing brace from here

    console.log(`Data purge completed for user ${userId}. Total keys deleted: ${deletedCount}`);
    return deletedCount;
    } catch (error) { // <<< This catch now correctly corresponds to the outer try block that starts after variable declarations
        console.error(`Error during data purge for user ${userId}:`, error);
        throw new Error(`Failed to purge data. Error: ${error.message}`); // Re-throw for handler
    }
}

/**
 * Get the count of status updates for a user within the current day (UTC).
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<number>} - Number of status updates today.
 */
export async function getStatusUpdateCountToday(userId, kvStore) {
    if (!userId || !kvStore) {
        console.error('getStatusUpdateCountToday: Missing userId or kvStore binding.');
        return 0;
    }
    const key = `user:${userId}:status_history`;

    try {
        const data = await kvStore.get(key, { type: 'json' });
        const history = (data && Array.isArray(data.history)) ? data.history : [];

        if (history.length === 0) return 0;

        // Get today's date boundaries in UTC
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Start of today UTC
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(today.getUTCDate() + 1); // Start of tomorrow UTC

        const todayCount = history.filter(status => {
            try {
                const statusDate = new Date(status.timestamp);
                return statusDate >= today && statusDate < tomorrow;
            } catch (e) {
                console.warn(`Could not parse timestamp for history entry: ${status.timestamp}`);
                return false;
            }
        }).length;

        console.log(`Found ${todayCount} status updates today for user ${userId}.`);
        return todayCount;
    } catch (error) {
        console.error(`KV Error counting status updates for user ${userId} (key: ${key}):`, error);
        return 0; // Return 0 on error
    }
}


// --- Interaction Logging ---

/**
 * Log user interaction for analytics or moderation.
 * Stores interactions keyed by the target user.
 * @param {string} targetUserId - User whose status/message received the interaction.
 * @param {string} actorUserId - User who performed the interaction.
 * @param {string} interactionType - Type of interaction (e.g., 'check_in', 'react_im_in').
 * @param {string} timestamp - ISO timestamp of the interaction.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @param {number} [logLimit=100] - Maximum number of log entries per user.
 * @returns {Promise<boolean>} - True if logging succeeded, false otherwise.
 */
export async function logUserInteraction(targetUserId, actorUserId, interactionType, timestamp, kvStore, logLimit = 100) {
  if (!targetUserId || !actorUserId || !interactionType || !timestamp || !kvStore) {
      console.error("logUserInteraction: Missing required arguments.");
      return false;
  }
  const key = `log:interactions:${targetUserId}`;

  try {
    // Get existing interaction log or initialize
    let interactions = await kvStore.get(key, { type: 'json' });
    let log = (interactions && Array.isArray(interactions.log)) ? interactions.log : [];

    // Add new interaction entry
    log.push({
      actor: actorUserId,
      type: interactionType,
      timestamp: timestamp
    });

    // Trim log if it exceeds the limit
    if (logLimit > 0 && log.length > logLimit) {
      log = log.slice(log.length - logLimit);
    }

    // Save updated log
    console.log(`KV PUT: Storing interaction log for key: ${key}`);
    await kvStore.put(key, JSON.stringify({ log }));
    console.log(`Logged interaction for target user ${targetUserId}. Log length: ${log.length}`);
    return true;
  } catch (error) {
    console.error(`KV Error logging interaction for target user ${targetUserId} (key: ${key}):`, error);
    return false;
  }
}

/**
 * Delete a status template for a user from KV storage.
 * @param {string} userId - Discord user ID.
 * @param {string} templateName - Name of the template to delete (case-insensitive comparison).
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<boolean>} - True if deletion succeeded or template didn't exist, false on error.
 */
export async function deleteStatusTemplate(userId, templateName, kvStore) {
  if (!userId || !templateName || !kvStore) {
    console.error('deleteStatusTemplate: Missing userId, templateName, or kvStore binding.');
    return false;
  }
  const key = `user:${userId}:templates`;

  try {
    // Get existing templates
    const data = await kvStore.get(key, { type: 'json' });
    let templates = (data && Array.isArray(data.templates)) ? data.templates : [];

    // Filter out the template to delete (case-insensitive)
    const lowerCaseName = templateName.toLowerCase();
    const initialLength = templates.length;
    templates = templates.filter(t => t.name.toLowerCase() !== lowerCaseName);

    if (templates.length < initialLength) {
        // Only write back if a template was actually removed
        console.log(`KV PUT: Storing updated templates after deleting "${templateName}" for key: ${key}`);
        await kvStore.put(key, JSON.stringify({ templates }));
        console.log(`Deleted template "${templateName}" for user ${userId}.`);
    } else {
        console.log(`Template "${templateName}" not found for user ${userId}, no deletion needed.`);
    }

    return true; // Return true even if template wasn't found (idempotent)
  } catch (error) {
    console.error(`KV Error deleting template "${templateName}" for user ${userId} (key: ${key}):`, error);
    return false;
  }
}
