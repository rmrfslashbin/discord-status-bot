// src/storage/activity.js - KV storage operations for activities

/**
 * Create a new activity associated with a status update.
 * @param {string} userId - Creator user ID.
 * @param {Object} activityData - Activity details (title, description, type).
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<string|null>} - Activity ID, or null on error.
 */
export async function createActivity(userId, activityData, kvStore) {
  if (!userId || !activityData || !kvStore) {
      console.error("createActivity: Missing userId, activityData, or kvStore.");
      return null;
  }
  try {
    // Generate unique activity ID
    const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Create activity object
    const activity = {
      id: activityId,
      creator: userId,
      title: activityData.title || 'Untitled Activity',
      description: activityData.description || '',
      type: activityData.type || 'general', // e.g., gaming, work, social
      // start_time: activityData.start_time || new Date().toISOString(), // Optional: Add if needed
      // end_time: activityData.end_time || null, // Optional: Add if needed
      max_participants: activityData.max_participants || 0, // 0 for unlimited
      participants: [userId], // Creator is automatically a participant
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store activity
    const key = `activity:${activityId}`;
    console.log(`KV PUT: Storing activity for key: ${key}`);
    await kvStore.put(key, JSON.stringify(activity));

    // Add to user's activity list (optional, could be useful later)
    // await addActivityToUserList(userId, activityId, kvStore);

    console.log(`Created activity ${activityId} by user ${userId}.`);
    return activityId;
  } catch (error) {
    console.error('Error creating activity:', error);
    return null; // Return null instead of throwing to allow graceful handling
  }
}

/**
 * Get activity data by ID.
 * @param {string} activityId - Activity ID.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object|null>} - Activity data object or null if not found/error.
 */
export async function getActivity(activityId, kvStore) {
  if (!activityId || !kvStore) {
      console.error("getActivity: Missing activityId or kvStore.");
      return null;
  }
  const key = `activity:${activityId}`;
  try {
    const activity = await kvStore.get(key, { type: 'json' });
    if (activity) {
        console.log(`Retrieved activity ${activityId}.`);
    } else {
        console.log(`Activity ${activityId} not found.`);
    }
    return activity; // Returns null if not found
  } catch (error) {
    console.error(`KV Error retrieving activity ${activityId}:`, error);
    return null;
  }
}

/**
 * Add a user to an activity's participant list.
 * @param {string} activityId - Activity ID.
 * @param {string} userId - User ID to add.
 * @param {KVNamespace} kvStore - The KV Namespace binding object.
 * @returns {Promise<Object|null>} - Updated activity object or null on error/failure.
 * @throws {Error} If activity is full or not found.
 */
export async function joinActivity(activityId, userId, kvStore) {
  if (!activityId || !userId || !kvStore) {
      console.error("joinActivity: Missing activityId, userId, or kvStore.");
      return null;
  }
  const key = `activity:${activityId}`;
  try {
    // Get activity
    const activity = await getActivity(activityId, kvStore);

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if max participants reached
    if (activity.max_participants > 0 && activity.participants.length >= activity.max_participants) {
      throw new Error('Activity is full');
    }

    // Check if user is already a participant
    if (activity.participants.includes(userId)) {
      console.log(`User ${userId} already in activity ${activityId}.`);
      return activity; // Already joined, return current activity state
    }

    // Add user to participants
    activity.participants.push(userId);
    activity.updated_at = new Date().toISOString();

    // Save updated activity
    console.log(`KV PUT: Updating activity participants for key: ${key}`);
    await kvStore.put(key, JSON.stringify(activity));
    console.log(`User ${userId} joined activity ${activityId}.`);

    // Add to user's activity list (optional)
    // await addActivityToUserList(userId, activityId, kvStore);

    return activity; // Return the updated activity object
  } catch (error) {
    console.error(`Error joining activity ${activityId} for user ${userId}:`, error);
    throw error; // Re-throw specific errors like "Activity not found" or "Activity is full"
  }
}

// Optional: Function to add activity to a user's list (if needed later)
/*
async function addActivityToUserList(userId, activityId, kvStore) {
  const key = `user:${userId}:activities`;
  try {
    let activities = await kvStore.get(key, { type: 'json' }) || { ids: [] };
    if (!activities.ids.includes(activityId)) {
      activities.ids.push(activityId);
      await kvStore.put(key, JSON.stringify(activities));
    }
    return true;
  } catch (error) {
    console.error(`Error adding activity ${activityId} to user ${userId}'s list:`, error);
    return false;
  }
}
*/
