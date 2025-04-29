# Dynamic Status Dashboard: LLM Prompt Engineering Guide

This guide provides detailed instructions for creating an effective LLM prompt that will power the dynamic status dashboard system.

## Core Objectives

The LLM prompt should enable:
1. Contextual understanding of user narratives
2. Retention of relevant previous information
3. Creation of personalized, adaptive status dashboards
4. Natural language synthesis of current and previous contexts

## LLM Prompt Structure

### System Context

```
You are an intelligent status analyzer that transforms personal status narratives into dynamic, visual status dashboards. Your goal is to understand the user's current state and context, while intelligently retaining relevant information from their previous status updates.
```

### User Context Provision

```
PREVIOUS STATUS CONTEXT (from [timestamp]):
[Include the previous status data here when available]

CURRENT STATUS UPDATE (at [timestamp]):
[User's current status text]
```

### Core Instructions

```
Create a dynamic status dashboard by analyzing both the current update and previous context. Intelligently determine which elements from the previous status are still relevant and should be carried forward, and which have been superseded or resolved by the current update.

Your analysis should:
1. Capture the overall mood and status
2. Identify specific metrics that matter in this context
3. Highlight activities, needs, and states
4. Retain relevant previous information that hasn't been contradicted
5. Create a natural narrative that combines new and persistent information
```

### Output Schema

```
Respond ONLY with valid JSON that follows this exact schema:

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
    // Include other detected personal states here
  ],

  "narrative_summary": "A concise 1-2 sentence natural language summary combining the most important current information and relevant persistent context.",

  "errors": [
    "A list of strings describing any issues encountered during analysis (e.g., 'Ambiguous statement about availability', 'Could not determine project progress'). Leave empty ([]) if no issues."
  ]
}
```

## Example Prompts

### Example 1: Initial Status

```
CURRENT STATUS UPDATE (at 2025-04-27 14:00):
Tired, hungry, and frustrated with this project. Been working since early morning and nothing is going right. Need to take a break soon.
```

### Example 2: Follow-up Status (With Context)

```
PREVIOUS STATUS CONTEXT (from 2025-04-27 14:00):
{
  "overall_status": "Overworked and frustrated",
  "mood_emoji": "😫",
  "visual_theme": "work",
  "accent_color": "burnt orange",
  "metrics": [
    {
      "name": "Energy",
      "value": "Very low",
      "value_rating": 1,
      "trend": "new",
      "icon": "⚡"
    },
    {
      "name": "Hunger",
      "value": "High",
      "value_rating": 4,
      "trend": "new",
      "icon": "🍽️"
    },
    {
      "name": "Frustration",
      "value": "High",
      "value_rating": 5,
      "trend": "new",
      "icon": "😤"
    }
  ],
  "highlights": [
    {
      "type": "activity",
      "description": "Working on project",
      "timeframe": "current",
      "is_new": true
    },
    {
      "type": "need",
      "description": "Need to take a break",
      "timeframe": "future",
      "is_new": true
    }
  ],
  "persistent_context": [],
  "narrative_summary": "Working on a difficult project since early morning, feeling tired, hungry, and intensely frustrated with lack of progress. Needs to take a break soon."
}

CURRENT STATUS UPDATE (at 2025-04-27 15:00):
Finally ate lunch at 14:30. Still slow going with the project though.
```

## Handling Special Cases

### No Previous Context

When no previous context exists, the LLM should:
- Focus entirely on the current update
- Generate comprehensive metrics and highlights
- Mark all elements as "new"
- Not include the "persistent_context" array
- Create a narrative that stands alone

### Explicit Overrides

The LLM should recognize when current information explicitly overrides previous states:
- "Not tired anymore" should remove the "tired" state
- "Feeling better now" should update emotional states
- Time-limited states should automatically expire when appropriate

### Ambiguous Updates

For ambiguous updates, the LLM should:
- Err on the side of retention when unclear
- Apply logical inference (e.g., if someone was hungry and mentions eating, assume hunger is resolved)
- Maintain emotional states unless contradicted
- Keep long-term activities in context unless completed or changed

## Contextual Relevance Decay

Guide the LLM to apply these principles for determining relevance:

1. **Time Sensitivity**:
   - Physical states (hunger, tiredness) decay faster
   - Emotional states (frustrated, happy) have medium persistence
   - Activities/projects have longest persistence

2. **Significance Weighting**:
   - Emphasized elements ("really frustrated") persist longer
   - Casual mentions decay faster
   - Explicitly time-bounded states respect their timeframes

3. **Update Frequency Adaptation**:
   - Frequent updaters get shorter context retention
   - Infrequent updaters get longer retention
   - Significant time gaps (>24h) should reset most context
