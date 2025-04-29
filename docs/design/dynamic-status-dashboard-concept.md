# Dynamic Status Dashboard: New Direction

## Core Concept Evolution

The Discord Status Dashboard is being redesigned to be more dynamic, expressive, and contextually aware. This document outlines the key shifts in approach for implementation.

## Moving from Static to Dynamic

### Previous Approach
- Fixed schema with predetermined categories
- Same metrics shown for all users
- Consistent but rigid visual presentation
- Single message that gets updated

### New Direction
- Flexible content-driven structure based on user's narrative
- Dynamically determined metrics relevant to the specific status
- Adaptive styling reflecting the emotional context
- Preservation of user's voice and narrative elements
- New message posted for each update (timeline approach)
- Context retention between updates

## Key Implementation Changes

### 1. Message Posting Strategy

**Previous:** 
- Create/update a single pinned message
- Each update overwrites previous information

**New:**
- Post a new message for each status update
- Create a visible timeline of status changes
- No message editing required
- Optional pinning of most recent status only

### 2. Context Retention ("Look Back" Functionality)

The system will maintain awareness of previous status elements and carry forward relevant context:

**Example Flow:**
1. User at 14:00: "Tired, hungry, and frustrated with this project."
   - Dashboard shows: Tired, hungry, frustrated, working on project
   
2. User at 15:00: "Finally ate lunch at 14:30"
   - Dashboard shows: **Tired, frustrated**, ate lunch at 14:30, working on project
   - Note: System retains "tired" and "frustrated" as they weren't addressed

3. User at 16:00: "Making good progress now, energy levels up!"
   - Dashboard shows: Energy improved, making progress, **frustrated**, ate lunch earlier
   - Note: System drops "tired" as it's been superseded, but keeps "frustrated" and project context

**Implementation Requirements:**
- Store previous status data in KV storage
- Implement contextual analysis to determine which states persist
- Apply intelligent merging of new information with carried-over context
- Weight recency of information in presentation
- Allow explicit overrides (e.g., "Not tired anymore" should remove that state)

### 3. Dynamic Schema

**Previous:**
```json
{
  "overall_status": "operational | degraded | offline",
  "emoji": "[emoji]",
  "metrics": {
    "energy_level": 1-5,
    "focus_level": 1-5,
    "availability": 1-5,
    "social_capacity": 1-5
  },
  "activities": { ... },
  "gaming": { ... },
  "communication": { ... },
  "context": { ... }
}
```

**New:**
```json
{
  "overall_status": "A brief phrase capturing their current overall status (e.g., 'Focusing on Project X', 'Relaxing after work', 'Feeling blocked')",
  "mood_emoji": "A single emoji that best represents their current mood (e.g., '😊', '☕', '🚧', '🎮')",
  "visual_theme": "work | gaming | social | rest | creative | learning | default",
  "accent_color": "A suggested hex color code (e.g., '#4287f5') or color name ('blue') that fits the mood/theme",

  "metrics": [
    {
      "name": "Name of the metric (e.g., 'Energy', 'Focus', 'Project Progress', 'Mood')",
      "value": "Textual or numeric value (e.g., 'Low', 'High', '75%', 'Good')",
      "value_rating": "Numeric rating 1-5 (optional, provide if easily inferred)",
      "trend": "improved | worsened | unchanged | new",
      "icon": "A single emoji representing this metric (e.g., '⚡', '🧠', '📊', '😊')"
    }
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

  "personal_states": [
    {
      "name": "Name of the personal state (e.g., Hunger, Arousal, Tiredness)",
      "emoji": "The corresponding emoji (e.g., 🍽️, 😈, 😴)",
      "level": "Intensity level 1-5",
      "time_since_last": "Human-readable time elapsed (e.g., '4h ago', '2d ago', 'just now')",
      "trend": "increasing | decreasing | stable | new"
    }
  ],

  "narrative_summary": "A concise 1-2 sentence natural language summary combining the most important current information and relevant persistent context.",

  "errors": [
    "A list of strings describing any issues encountered during analysis (e.g., 'Ambiguous statement about availability', 'Could not determine project progress'). Leave empty ([]) if no issues."
  ]
}
```

### 4. LLM Prompt Evolution

**Previous:**
- Strict instructions to fit user status into predefined schema
- Focus on extracting fixed metrics

**New:**
```
Analyze the user's status update and generate a dynamic status dashboard that reflects their unique situation.

1. Extract the most important elements from the user's narrative
2. Identify 2-4 metrics that are specifically relevant to what they described
3. Consider previous status context (if provided) and determine which elements are still relevant
4. Create a response that preserves their voice while organizing the information
5. Select a visual theme that best matches the primary context (work, gaming, social, rest, creative)
6. Highlight specific activities, needs, or states they mentioned
7. Create a natural summary that combines new information with still-relevant previous context

Only include information that would reasonably be inferred from the user's current or previous messages.
```

## Visual Presentation

### Dynamic Styling

Different visual themes based on primary context:
- **Work/Professional**: Blue tones, productivity icons, structured layout
- **Gaming/Leisure**: Purple/green tones, gaming icons, energetic layout
- **Social**: Warm colors, community icons, open layout
- **Rest/Recharge**: Calm colors, wellness icons, minimalist layout
- **Creative**: Vibrant colors, artistic icons, fluid layout

### Content Adaptation

- Layout adjusts based on what information is available
- Sections appear/disappear based on relevance
- Visual indicators for:
  - New information (✨)
  - Persisting states (⟳)
  - Improved states (↗️)
  - Worsened states (↘️)

## Technical Implementation Considerations

### Storage Strategy

- Store full status history with timestamps
- Index by user ID for quick access
- Implement context weighting to determine relevance decay
- Configurable retention policy (how far back to look)

### Processing Flow

1. Receive status update
2. Retrieve previous status data
3. Combine in LLM prompt context
4. Process with LLM to determine contextual relationships
5. Format and post new status message
6. Store updated context

### Performance Optimization

- Only include recent and relevant previous statuses in the LLM context
- Implement caching for frequent updaters
- Use a sliding window approach for context retention
