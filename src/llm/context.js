// src/llm/context.js - Context relevance calculation and filtering

/**
 * Calculate the contextual relevance of elements within a previous status object.
 * Adds a 'relevance_score' (0-1) to metrics and highlights based on time decay.
 * @param {Object | null} previousStatus - The previous status entry object (containing timestamp and processed_status).
 * @returns {Object | null} - The previous status object with added relevance scores, or null if input was null.
 */
export function calculateContextRelevance(previousStatus) {
  if (!previousStatus || !previousStatus.timestamp || !previousStatus.processed_status) {
      console.log("No valid previous status provided for relevance calculation.");
      return null;
  }

  try {
    const previousTime = new Date(previousStatus.timestamp);
    const currentTime = new Date();
    // Ensure valid dates before calculating difference
    if (isNaN(previousTime.getTime())) {
        console.error("Invalid timestamp in previous status:", previousStatus.timestamp);
        return previousStatus; // Return original object without scores if timestamp is bad
    }
    const hoursDifference = Math.abs(currentTime - previousTime) / (1000 * 60 * 60);

    // Define relevance decay rates (lower divisor = faster decay)
    const relevanceFactors = {
      physical: Math.max(0, 1 - (hoursDifference / 6)),  // Relevant for ~6 hours
      emotional: Math.max(0, 1 - (hoursDifference / 12)), // Relevant for ~12 hours
      activity: Math.max(0, 1 - (hoursDifference / 36)), // Relevant for ~36 hours
      event: Math.max(0, 1 - (hoursDifference / 24)),   // Relevant for ~24 hours (like 'state')
      state: Math.max(0, 1 - (hoursDifference / 12)),   // Same as emotional
      need: Math.max(0, 1 - (hoursDifference / 8)),    // Needs decay relatively fast
      achievement: Math.max(0, 1 - (hoursDifference / 48)), // Achievements last longer
      default: Math.max(0, 1 - (hoursDifference / 18)) // Fallback relevance
    };

    // --- Apply relevance decay to METRICS ---
    // Note: The new schema has metrics as an array of objects.
    const metricsWithRelevance = (previousStatus.processed_status.metrics || []).map(metric => {
      let type = 'default'; // Default type
      const nameLower = metric.name?.toLowerCase() || '';

      // Simple keyword-based categorization (adjust keywords as needed)
      if (['energy', 'hunger', 'sleep', 'tired', 'physical'].some(term => nameLower.includes(term))) {
        type = 'physical';
      } else if (['focus', 'mood', 'stress', 'feeling'].some(term => nameLower.includes(term))) {
        type = 'emotional';
      } else if (['project', 'work', 'task', 'progress', 'coding', 'writing'].some(term => nameLower.includes(term))) {
        type = 'activity';
      }
      // Add more categorization logic if needed

      return {
        ...metric,
        relevance_score: relevanceFactors[type] || relevanceFactors.default
      };
    });

    // --- Apply relevance decay to HIGHLIGHTS ---
    // Note: The new schema has highlights as an array of objects.
    const highlightsWithRelevance = (previousStatus.processed_status.highlights || []).map(highlight => {
      const type = highlight.type?.toLowerCase() || 'default'; // Use highlight type directly
      return {
        ...highlight,
        relevance_score: relevanceFactors[type] || relevanceFactors.default
      };
    });

     // --- Apply relevance decay to PERSISTENT CONTEXT ---
     // These might represent longer-term states, apply a slower decay or specific logic if needed.
     // For now, let's use 'activity' decay as a proxy for longer persistence.
     const persistentContextWithRelevance = (previousStatus.processed_status.persistent_context || []).map(context => {
        return {
            ...context,
            relevance_score: relevanceFactors['activity'] // Assume longer relevance
        };
     });


    // Return the previous status object with updated processed_status containing relevance scores
    return {
      ...previousStatus,
      processed_status: {
        ...previousStatus.processed_status,
        metrics: metricsWithRelevance,
        highlights: highlightsWithRelevance,
        persistent_context: persistentContextWithRelevance // Include context with scores
      }
    };
  } catch (error) {
      console.error("Error calculating context relevance:", error);
      return previousStatus; // Return original object in case of error
  }
}

/**
 * Filter out elements from a context object that fall below a relevance threshold.
 * Operates on an object previously processed by calculateContextRelevance.
 * @param {Object | null} contextWithRelevance - The context object containing relevance scores.
 * @param {number} [threshold=0.3] - Minimum relevance score (0-1) to keep an element.
 * @returns {Object | null} - The context object with low-relevance elements filtered out, or null if input was null.
 */
export function filterRelevantContext(contextWithRelevance, threshold = 0.3) {
  if (!contextWithRelevance || !contextWithRelevance.processed_status) {
      console.log("No valid context with relevance scores provided for filtering.");
      return null;
  }
   if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
        console.warn(`Invalid relevance threshold: ${threshold}. Using default 0.3.`);
        threshold = 0.3;
    }

  try {
    const filteredMetrics = (contextWithRelevance.processed_status.metrics || [])
      .filter(m => typeof m.relevance_score === 'number' && m.relevance_score >= threshold);

    const filteredHighlights = (contextWithRelevance.processed_status.highlights || [])
      .filter(h => typeof h.relevance_score === 'number' && h.relevance_score >= threshold);

    const filteredPersistentContext = (contextWithRelevance.processed_status.persistent_context || [])
        .filter(p => typeof p.relevance_score === 'number' && p.relevance_score >= threshold);

    console.log(`Filtered context: ${filteredMetrics.length} metrics, ${filteredHighlights.length} highlights, ${filteredPersistentContext.length} persistent items remaining (threshold: ${threshold}).`);

    // Return a *new* object with filtered arrays
    return {
      ...contextWithRelevance,
      processed_status: {
        ...contextWithRelevance.processed_status,
        metrics: filteredMetrics,
        highlights: filteredHighlights,
        persistent_context: filteredPersistentContext
      }
    };
  } catch (error) {
      console.error("Error filtering relevant context:", error);
      return contextWithRelevance; // Return unfiltered object in case of error
  }
}


// --- Personal State Time Tracking ---

/**
 * Placeholder: Calculate time elapsed since the previous status update timestamp.
 * @param {string} previousTimestampISO - ISO timestamp string of the previous update.
 * @returns {string} - Human-readable time difference (e.g., "30m", "2h", "1d").
 */
function getTimeSinceUpdate(previousTimestampISO) {
    // TODO: Implement actual time difference calculation
    // This needs to parse the ISO string and compare with Date.now()
    // For now, return a placeholder
    try {
        const prevDate = new Date(previousTimestampISO);
        const now = new Date();
        const diffMinutes = Math.round((now - prevDate) / (1000 * 60));

        if (diffMinutes < 1) return "now"; // Less than a minute
        if (diffMinutes < 60) return `${diffMinutes}m`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays}d`;
    } catch (e) {
        console.error("Error calculating time since update:", e);
        return "unknown";
    }
}

/**
 * Placeholder: Update a previous time elapsed string by adding more time.
 * @param {string} prevTimeStr - Previous time string (e.g., "2h ago").
 * @param {string} additionalTimeStr - Time since update (e.g., "30m").
 * @returns {string} - Updated time string (e.g., "2h 30m ago").
 */
function updateTimeElapsed(prevTimeStr, additionalTimeStr) {
    // TODO: Implement actual time string parsing and addition.
    // This is complex due to various units (m, h, d, ago, just now).
    // For now, just return the newer string if available, or the old one.
    // A more robust solution would convert both to minutes, add, then format back.
    console.warn(`Time addition not fully implemented. Prev: ${prevTimeStr}, Add: ${additionalTimeStr}`);
    // Very basic placeholder - doesn't actually add time
    if (prevTimeStr && prevTimeStr !== 'just now') {
        return `${prevTimeStr} + ${additionalTimeStr}`;
    }
    return prevTimeStr || additionalTimeStr || 'unknown';
}


/**
 * Update personal state times based on new information and previous context.
 * Calculates trends and updates time_since_last where appropriate.
 * @param {Array} previousStates - Array of personal state objects from the previous status.
 * @param {Array} currentStates - Array of personal state objects from the current LLM analysis.
 * @param {string} previousTimestampISO - ISO timestamp of the previous status update.
 * @returns {Array} - Updated array of current personal states with trends and time tracking.
 */
export function updatePersonalStateTimes(previousStates = [], currentStates = [], previousTimestampISO) {
  if (!Array.isArray(previousStates)) previousStates = [];
  if (!Array.isArray(currentStates)) currentStates = [];

  // Create a map of previous states for quick lookup
  const prevStateMap = new Map();
  previousStates.forEach(state => {
    if (state && state.name) {
        prevStateMap.set(state.name, state);
    }
  });

  const timeSinceUpdateStr = previousTimestampISO ? getTimeSinceUpdate(previousTimestampISO) : null;

  // Update current states with time information and trends
  return currentStates.map(currentState => {
    if (!currentState || !currentState.name) return currentState; // Skip invalid entries

    const prevState = prevStateMap.get(currentState.name);
    let updatedState = { ...currentState }; // Start with current data

    if (!prevState) {
      // State is new in this update
      updatedState.trend = 'new';
    } else {
      // State existed previously, determine trend and update time
      let trend = 'stable';
      const prevLevel = parseInt(prevState.level, 10);
      const currentLevel = parseInt(currentState.level, 10);

      if (!isNaN(currentLevel) && !isNaN(prevLevel)) {
          if (currentLevel > prevLevel) trend = 'increasing';
          else if (currentLevel < prevLevel) trend = 'decreasing';
      }
      updatedState.trend = trend;

      // Time tracking logic:
      // If the current state indicates satisfaction (e.g., level is low, or specific keywords were used),
      // the LLM *should* ideally set time_since_last to 'just now' or similar.
      // If the current state *doesn't* specify time_since_last, but the previous one did,
      // we *could* try to update the previous time.
      if (!updatedState.time_since_last && prevState.time_since_last && timeSinceUpdateStr) {
          // LLM didn't provide a new time, try updating the old one
          // Note: This assumes the need wasn't met. If it was, LLM should have said 'just now'.
          updatedState.time_since_last = updateTimeElapsed(prevState.time_since_last, timeSinceUpdateStr);
          console.log(`Updated time for ${currentState.name}: ${updatedState.time_since_last}`);
      } else if (updatedState.time_since_last) {
          // LLM provided a time, use it directly.
          console.log(`Using LLM provided time for ${currentState.name}: ${updatedState.time_since_last}`);
      } else {
          // No time provided by LLM, and no previous time to update. Leave as is.
          console.log(`No time information available or needed for ${currentState.name}`);
      }
    }

    return updatedState;
  });
}
