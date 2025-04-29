// src/storage/profile.js - KV storage operations for user profiles

const DEFAULT_PROFILE = {
  preferences: {
    theme: 'default',
    visibility: 'public', // public | private
  },
  custom_emojis: {}, // { stateName: emoji }
  timezone: null, // Store timezone identifier (e.g., 'America/New_York')
  created_at: null,
  updated_at: null,
};

/**
 * Get the user's profile from KV storage, creating a default if it doesn't exist.
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object>} - The user profile object.
 */
export async function getUserProfile(userId, kvStore) {
  if (!userId || !kvStore) {
    console.error('getUserProfile: Missing userId or kvStore binding.');
    // Return a deep copy of the default profile to prevent modification
    return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }
  const key = `profile:${userId}`;

  try {
    let profile = await kvStore.get(key, { type: 'json' });

    if (!profile) {
      console.log(`No profile found for user ${userId}. Creating default profile.`);
      profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE)); // Deep copy
      profile.created_at = new Date().toISOString();
      profile.updated_at = profile.created_at;
      // Store the newly created default profile
      console.log(`KV PUT: Storing default profile for key: ${key}`);
      await kvStore.put(key, JSON.stringify(profile));
    } else {
      // Ensure all default keys exist on the loaded profile
      profile = { ...JSON.parse(JSON.stringify(DEFAULT_PROFILE)), ...profile };
      profile.preferences = { ...DEFAULT_PROFILE.preferences, ...(profile.preferences || {}) };
      profile.custom_emojis = { ...DEFAULT_PROFILE.custom_emojis, ...(profile.custom_emojis || {}) };
       console.log(`Retrieved profile for user ${userId}.`);
    }

    return profile;
  } catch (error) {
    console.error(`KV Error retrieving profile for user ${userId} (key: ${key}):`, error);
    // Return a deep copy of the default profile on error
    return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }
}

/**
 * Update specific fields in a user's profile.
 * @param {string} userId - Discord user ID.
 * @param {Object} updates - An object containing the fields to update (e.g., { timezone: '...', 'preferences.theme': '...' }).
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<boolean>} - True if update succeeded, false otherwise.
 */
export async function updateUserProfile(userId, updates, kvStore) {
  if (!userId || !updates || Object.keys(updates).length === 0 || !kvStore) {
    console.error('updateUserProfile: Missing userId, updates, or kvStore binding.');
    return false;
  }
  const key = `profile:${userId}`;

  try {
    // Get the current profile first to ensure we don't overwrite unrelated fields
    let profile = await getUserProfile(userId, kvStore); // getUserProfile handles creation if needed

    // Apply updates - This handles nested paths like 'preferences.theme'
    Object.keys(updates).forEach(path => {
        const value = updates[path];
        const keys = path.split('.');
        let current = profile;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || typeof current[key] !== 'object') {
                current[key] = {}; // Create nested object if it doesn't exist
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    });

    profile.updated_at = new Date().toISOString();

    // Store the updated profile
    console.log(`KV PUT: Storing updated profile for key: ${key}`);
    await kvStore.put(key, JSON.stringify(profile));
    console.log(`Updated profile for user ${userId}.`);
    return true;
  } catch (error) {
    console.error(`KV Error updating profile for user ${userId} (key: ${key}):`, error);
    return false;
  }
}


/**
 * Get the user's custom emoji set.
 * @param {string} userId - Discord user ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object>} - The custom_emojis object from the profile.
 */
export async function getUserEmojiSet(userId, kvStore) {
    const profile = await getUserProfile(userId, kvStore);
    return profile.custom_emojis || {};
}

/**
 * Set or unset a custom emoji for a specific state name.
 * @param {string} userId - Discord user ID.
 * @param {string} stateName - The name of the state (case-insensitive storage key).
 * @param {string} emoji - The emoji string. Use empty string "" or null to unset.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<boolean>} - True if update succeeded, false otherwise.
 */
export async function setCustomEmoji(userId, stateName, emoji, kvStore) {
    if (!userId || !stateName || !kvStore) {
        console.error('setCustomEmoji: Missing userId, stateName, or kvStore binding.');
        return false;
    }
    const key = `profile:${userId}`;
    const stateKey = stateName.toLowerCase(); // Use lowercase for key consistency

    try {
        let profile = await getUserProfile(userId, kvStore); // Get or create profile

        if (!profile.custom_emojis) {
            profile.custom_emojis = {};
        }

        if (emoji && emoji.trim().length > 0) {
            profile.custom_emojis[stateKey] = emoji;
            console.log(`Set custom emoji for state "${stateKey}" for user ${userId}.`);
        } else {
            // Delete the key if emoji is empty or null
            delete profile.custom_emojis[stateKey];
            console.log(`Reset custom emoji for state "${stateKey}" for user ${userId}.`);
        }

        profile.updated_at = new Date().toISOString();

        console.log(`KV PUT: Storing updated profile after emoji change for key: ${key}`);
        await kvStore.put(key, JSON.stringify(profile));
        return true;
    } catch (error) {
        console.error(`KV Error setting custom emoji for user ${userId} (key: ${key}):`, error);
        return false;
    }
}
