# Enhanced Status Dashboard: Emoji-Based Personal State Tracking

This document provides implementation guidance for adding a comprehensive emoji-based personal state tracking system to the Discord Status Dashboard.

## Overview

To enhance the status dashboard with appropriate representation of all personal states including physical, emotional, and intimate needs, we'll implement an emoji-based system that tracks both the intensity level and time elapsed since last satisfaction.

## Emoji System Implementation

### Updated LLM Prompt

Update the LLM system prompt to include the following guidance:

```javascript
function createContextAwarePrompt(previousStatus) {
  let prompt = `
You are an intelligent status analyzer that transforms personal status narratives into dynamic, visual status dashboards. Your goal is to understand the user's current state and context, including physical, emotional, and social needs.

PERSONAL STATE REPRESENTATION GUIDELINES:
1. Translate ALL aspects of a user's status into appropriate dashboard indicators.
2. Use the following emoji system to represent personal states and needs:
   - 😈 - Indicates high arousal or sexual interest
   - 😴 - Indicates tiredness or need for rest
   - 🍽️ - Indicates hunger or need for food
   - 🥤 - Indicates thirst or need for hydration
   - 🧠 - Indicates mental stimulation needs (boredom/engagement)
   - 🫂 - Indicates desire for connection or companionship
   - 🎮 - Indicates desire for entertainment or distraction
   - 🌿 - Indicates need for relaxation or calm

3. For each personal state, include BOTH the current intensity level (1-5) AND time elapsed since last satisfaction when mentioned or implied:
   - Express time elapsed in a human-readable format (e.g., "2h ago", "3d ago", "just now")
   - Infer reasonable times based on context when not explicitly stated
   - Track these times between status updates when possible

4. Add these emoji indicators to the appropriate metrics section rather than describing explicit details.
5. Focus on the intensity level (1-5) of these needs rather than specific activities.
6. For the narrative summary, use general phrases like "seeking personal connection" or "enjoying personal time" rather than specific details.

This is a private system with limited audience where users need to accurately represent their complete status, including personal needs and desires, in a tasteful way.

Create a dynamic status dashboard that includes these personal state indicators along with other relevant information about the user's current context and previous status updates.
  `;

  // Rest of the original prompt follows...

  return prompt;
}
```

### JSON Schema Update

Extend the existing schema to include personal states:

```javascript
// Example output schema:
{
  "overall_status": "A brief phrase capturing their status",
  "mood_emoji": "A single emoji that best represents their current mood",
  "visual_theme": "work | gaming | social | rest | creative",
  "accent_color": "color name or hex code that fits the mood",

  "metrics": [
    {
      "name": "Name of the metric (e.g., 'Energy', 'Focus', 'Project Progress', 'Mood')",
      "value": "Textual or numeric value (e.g., 'Low', 'High', '75%', 'Good')",
      "value_rating": "Numeric rating 1-5 (optional, provide if easily inferred)",
      "trend": "improved | worsened | unchanged | new",
      "icon": "A single emoji representing this metric (e.g., '⚡', '🧠', '📊', '😊')"
    }
  ],

  "personal_states": [
    {
      "name": "Name of the personal state (e.g., Hunger, Arousal, Tiredness)",
      "emoji": "The corresponding emoji (e.g., 🍽️, 😈, 😴)",
      "level": "Intensity level 1-5",
      "time_since_last": "Human-readable time elapsed (e.g., '4h ago', '2d ago', 'just now')",
      "trend": "increasing | decreasing | stable | new"
    }
    // Include other detected personal states here
  ],

  "highlights": [
    {
      "type": "activity | event | state | need | achievement | blocker",
      "description": "Description of the highlight (e.g., 'Working on API integration', 'Attended team meeting', 'Feeling tired', 'Need coffee', 'Fixed critical bug', 'Waiting for review')",
      "timeframe": "past | current | future | ongoing",
      "is_new": "true if this highlight is primarily from the current update, false if mainly carried over/updated from previous context"
    }
  ],

  "persistent_context": [
    {
      "description": "Description of a relevant state or context carried over from previous updates (e.g., 'Ongoing project: Dashboard UI', 'Recovering from cold')",
      "from_previous": true,
      "source_timestamp": "Timestamp of the status where this context originated (e.g., '2025-04-28T15:00:00Z')"
    }
  ],

  "narrative_summary": "A concise 1-2 sentence natural language summary combining the most important current information and relevant persistent context.",

  "errors": [
    "A list of strings describing any issues encountered during analysis (e.g., 'Ambiguous statement about availability', 'Could not determine project progress'). Leave empty ([]) if no issues."
  ]
}
```

## Discord Message Formatting

Update the Discord message formatting to display personal states:

```javascript
export function formatDiscordMessage(statusData, userId, previousStatus = null) {
  // ... existing code ...

  // Convert numeric ratings to bar graph
  function ratingToBlocks(rating) {
    return '■'.repeat(rating) + '□'.repeat(5 - rating);
  }

  // Format trend indicators
  function getTrendIndicator(trend) {
    return trend === 'increasing' ? '↗️' :
           trend === 'decreasing' ? '↘️' :
           trend === 'stable' ? '⟳' : '✨';
  }

  // ... existing fields ...

  // Create a personal states section if any indicators exist
  const personalStates = statusData.personal_states || [];
  if (personalStates.length > 0) {
    fields.push({
      name: '🧬 Personal State',
      value: personalStates.map(state => {
        const trendIndicator = getTrendIndicator(state.trend);
        let stateText = `${state.emoji} ${state.name}: ${trendIndicator} ${ratingToBlocks(state.level)} (${state.level}/5)`;

        // Add time since last if available
        if (state.time_since_last) {
          stateText += ` | Last: ${state.time_since_last}`;
        }

        return stateText;
      }).join('\n'),
      inline: false
    });
  }

  // ... rest of the function ...
}
```

## Context Retention for Personal States

Update the context retention system to track personal states over time:

```javascript
/**
 * Update personal state times based on new information
 * @param {Array} previousStates - Previous personal states
 * @param {Array} currentStates - Current personal states
 * @returns {Array} - Updated states with time tracking
 */
function updatePersonalStateTimes(previousStates, currentStates) {
  if (!previousStates || previousStates.length === 0) {
    return currentStates;
  }

  // Create a map of previous states for quick lookup
  const prevStateMap = {};
  previousStates.forEach(state => {
    prevStateMap[state.name] = state;
  });

  // Update current states with time information
  return currentStates.map(state => {
    const prevState = prevStateMap[state.name];

    // If no previous state, return as is
    if (!prevState) {
      return {
        ...state,
        trend: 'new'
      };
    }

    // Determine trend based on level change
    let trend = 'stable';
    if (state.level > prevState.level) {
      trend = 'increasing';
    } else if (state.level < prevState.level) {
      trend = 'decreasing';
    }

    // If current status indicates satisfaction, reset the time
    if (state.name === 'Hunger' && state.reset_time) {
      return {
        ...state,
        time_since_last: 'just now',
        trend
      };
    }

    // Otherwise, carry forward the previous time if not specified
    if (!state.time_since_last && prevState.time_since_last) {
      // Calculate new time based on elapsed time since previous status
      const prevTime = prevState.time_since_last;
      const timeSinceUpdate = getTimeSinceUpdate(previousStatus.timestamp);

      return {
        ...state,
        time_since_last: updateTimeElapsed(prevTime, timeSinceUpdate),
        trend
      };
    }

    return {
      ...state,
      trend
    };
  });
}

/**
 * Update time elapsed string with additional time
 * @param {string} prevTimeStr - Previous time string (e.g., "2h ago")
 * @param {string} additionalTimeStr - Time since update (e.g., "30m")
 * @returns {string} - Updated time string
 */
function updateTimeElapsed(prevTimeStr, additionalTimeStr) {
  // Implementation details for time calculation...
  // This would convert time strings to minutes/hours/days and add them

  // Simplified example
  return prevTimeStr; // Replace with actual calculation
}
```

## Integration into Status Processing Flow

Update the main processing function to include personal state tracking:

```javascript
export async function processStatusUpdate(statusText, userId) {
  try {
    // 1. Get previous status data
    let previousStatus = await getLatestUserStatus(userId);

    // 2. Apply relevance decay and filtering
    if (previousStatus) {
      previousStatus = calculateContextRelevance(previousStatus);
      previousStatus = filterRelevantContext(previousStatus, 0.3);
    }

    // 3. Process with LLM, including context when available
    const statusData = await processWithLLM(statusText, previousStatus);

    // 4. Update personal state time tracking
    if (previousStatus && previousStatus.processed_status.personal_states) {
      statusData.personal_states = updatePersonalStateTimes(
        previousStatus.processed_status.personal_states,
        statusData.personal_states || []
      );
    }

    // 5. Store the new status data
    await storeUserStatus(userId, statusText, statusData);

    // 6. Format and post Discord message
    const messageData = formatDiscordMessage(statusData, userId, previousStatus);
    const channelId = config.discord.statusChannelId;

    // 7. Create a new status message
    const messageId = await createStatusMessage(channelId, messageData);

    return { statusData, messageId };
  } catch (error) {
    console.error('Error processing status update:', error);
    throw error;
  }
}
```

## Example Status Updates and Expected Outcomes

### Example 1: Initial Status with Multiple Needs

**User Input**: "I'm feeling hungry and tired. Haven't eaten in 4 hours and didn't sleep well last night."

**Expected Dashboard**:
```
🧬 Personal State
🍽️ Hunger: ✨ ■■■■□ (4/5) | Last: 4h ago
😴 Tiredness: ✨ ■■■■□ (4/5) | Last: >8h ago
```

### Example 2: Update After Eating

**User Input**: "Just had dinner, feeling much better. Still tired though."

**Expected Dashboard**:
```
🧬 Personal State
🍽️ Hunger: ↘️ ■□□□□ (1/5) | Last: just now
😴 Tiredness: ⟳ ■■■■□ (4/5) | Last: >8h ago
```

### Example 3: Status with Intimate Needs

**User Input**: "Feeling frustrated, haven't had any intimate time with my partner in days."

**Expected Dashboard**:
```
🧬 Personal State
😈 Arousal: ✨ ■■■■□ (4/5) | Last: several days ago
🫂 Connection: ✨ ■■■■■ (5/5) | Last: unknown
```

## Implementation Checklist

- [ ] Update the LLM prompt with emoji system guidelines
- [ ] Extend JSON schema to include personal_states array
- [ ] Update Discord message formatting to display personal states
- [ ] Implement context retention for personal state tracking
- [ ] Add time elapsed calculations and updates
- [ ] Test with various input scenarios
- [ ] Refine emoji selection and naming conventions as needed
