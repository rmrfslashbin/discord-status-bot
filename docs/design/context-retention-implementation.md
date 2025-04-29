# Context Retention System: Technical Implementation

This document outlines the technical approach for implementing the context retention ("look back") functionality in the Dynamic Status Dashboard.

## System Requirements

The context retention system must:
1. Store historical status data
2. Retrieve relevant previous context
3. Provide this context to the LLM
4. Interpret context-aware LLM responses
5. Present a coherent timeline of status updates

## Data Storage Schema

### KV Storage Structure

```
KEY: user:{userId}:status_history
VALUE: [
  {
    "timestamp": "ISO-8601 date string",
    "raw_input": "Original user text",
    "processed_status": {
      // Full JSON status object from LLM
    }
  },
  // Additional status entries...
]
```

### Additional Indices

```
KEY: user:{userId}:latest_status
VALUE: {timestamp, processed_status}

KEY: user:{userId}:status_metrics_history
VALUE: {
  "metric_name1": [
    {"timestamp": "ISO date", "value": value, "value_rating": 1-5},
    // Historical values...
  ],
  // Additional metrics...
}
```

## Processing Flow

### 1. Status Update Reception

When a new status update is received:

```javascript
async function handleStatusUpdate(userId, statusText) {
  try {
    // Get user's status history
    const history = await getUserStatusHistory(userId);
    
    // Get most recent status (if exists)
    const latestStatus = history.length > 0 ? history[history.length - 1] : null;
    
    // Format context for LLM
    const llmContext = formatContextForLLM(latestStatus, statusText);
    
    // Process with LLM
    const processedStatus = await processWithLLM(llmContext);
    
    // Store new status
    await storeUserStatus(userId, statusText, processedStatus);
    
    // Post to Discord
    await postStatusToDiscord(userId, processedStatus);
    
    return processedStatus;
  } catch (error) {
    console.error('Error handling status update:', error);
    throw error;
  }
}
```

### 2. Context Formatting

```javascript
function formatContextForLLM(previousStatus, currentStatusText) {
  let contextPrompt = '';
  
  if (previousStatus) {
    contextPrompt += `PREVIOUS STATUS CONTEXT (from ${previousStatus.timestamp}):\n`;
    contextPrompt += JSON.stringify(previousStatus.processed_status, null, 2);
    contextPrompt += '\n\n';
  }
  
  contextPrompt += `CURRENT STATUS UPDATE (at ${new Date().toISOString()}):\n`;
  contextPrompt += currentStatusText;
  
  return contextPrompt;
}
```

### 3. Status Storage

```javascript
async function storeUserStatus(userId, rawInput, processedStatus) {
  // Get existing history
  let history = await getUserStatusHistory(userId);
  
  // Create new status entry
  const newStatus = {
    timestamp: new Date().toISOString(),
    raw_input: rawInput,
    processed_status: processedStatus
  };
  
  // Add to history
  history.push(newStatus);
  
  // Trim history if needed (keeping last 20 entries)
  if (history.length > 20) {
    history = history.slice(history.length - 20);
  }
  
  // Store updated history (assuming kvStore is available)
  await kvStore.put(
    `user:${userId}:status_history`,
    JSON.stringify({ history })
  );

  // Update latest status reference (assuming kvStore is available)
  await kvStore.put(
    `user:${userId}:latest_status`,
    JSON.stringify(newStatus)
  );

  // Metrics history tracking was not implemented
  // await updateMetricsHistory(userId, newStatus);

  return newStatus;
}
```

### 4. Metrics History Tracking

```javascript
async function updateMetricsHistory(userId, statusEntry) {
  // Get existing metrics history
  let metricsHistory = JSON.parse(
    await STATUS_BOT_STORAGE.get(`user:${userId}:status_metrics_history`) || '{}'
  );
  
  // Extract metrics from the new status
  const { timestamp, processed_status } = statusEntry;
  
  // Update each metric's history
  for (const metric of processed_status.metrics) {
    if (!metricsHistory[metric.name]) {
      metricsHistory[metric.name] = [];
    }
    
    metricsHistory[metric.name].push({
      timestamp,
      value: metric.value,
      value_rating: metric.value_rating
    });
    
    // Keep only last 50 entries per metric
    if (metricsHistory[metric.name].length > 50) {
      metricsHistory[metric.name] = metricsHistory[metric.name].slice(-50);
    }
  }
  
  // Store updated metrics history
  await STATUS_BOT_STORAGE.put(
    `user:${userId}:status_metrics_history`, 
    JSON.stringify(metricsHistory)
  );
}
```

## Implementing Time-Based Relevance Decay

### Calculating Contextual Relevance

```javascript
function calculateContextRelevance(previousStatus, currentTime) {
  const previousTime = new Date(previousStatus.timestamp);
  const hoursDifference = (currentTime - previousTime) / (1000 * 60 * 60);
  
  // Base relevance factors
  const relevanceFactors = {
    // Physical states decay quickly
    physical: Math.max(0, 1 - (hoursDifference / 6)),  // ~6 hour relevance
    
    // Emotional states have medium persistence
    emotional: Math.max(0, 1 - (hoursDifference / 12)), // ~12 hour relevance
    
    // Activities/projects have longest persistence
    activity: Math.max(0, 1 - (hoursDifference / 36)),  // ~36 hour relevance
  };
  
  // Apply relevance decay to each element
  let contextWithRelevance = {
    ...previousStatus.processed_status,
    metrics: previousStatus.processed_status.metrics.map(metric => {
      let relevanceType = 'emotional'; // Default
      
      // Categorize metrics by type
      if (['Energy', 'Hunger', 'Sleep', 'Physical'].some(term => 
          metric.name.toLowerCase().includes(term.toLowerCase()))) {
        relevanceType = 'physical';
      } else if (['Project', 'Work', 'Task', 'Activity'].some(term => 
          metric.name.toLowerCase().includes(term.toLowerCase()))) {
        relevanceType = 'activity';
      }
      
      return {
        ...metric,
        relevance_score: relevanceFactors[relevanceType]
      };
    }),
    
    // Apply similar logic to highlights and persistent_context
    // ...
  };
  
  return contextWithRelevance;
}
```

### Filtering Low-Relevance Context

```javascript
function filterRelevantContext(contextWithRelevance, threshold = 0.3) {
  return {
    ...contextWithRelevance,
    metrics: contextWithRelevance.metrics.filter(m => m.relevance_score > threshold),
    highlights: contextWithRelevance.highlights.filter(h => 
      h.type === 'activity' ? h.relevance_score > threshold : h.relevance_score > 0.5
    ),
    persistent_context: contextWithRelevance.persistent_context.filter(p => 
      p.relevance_score > threshold
    )
  };
}
```

## Handling Multiple Status Updates

For users with frequent updates, we can provide richer context:

```javascript
function getEnhancedContextForFrequentUpdater(userId, currentStatusText) {
  // Get user's recent status history (last 3-5 entries)
  const recentHistory = await getUserStatusHistory(userId, 5);
  
  // Current time for relevance calculations
  const currentTime = new Date();
  
  // Format each with relevance decay
  const formattedHistory = recentHistory.map(status => {
    const withRelevance = calculateContextRelevance(status, currentTime);
    return filterRelevantContext(withRelevance);
  });
  
  // Create enhanced context with trend analysis
  let enhancedContext = {
    recent_updates: formattedHistory,
    trends: analyzeStatusTrends(formattedHistory),
    current_update: currentStatusText,
    timestamp: currentTime.toISOString()
  };
  
  return enhancedContext;
}
```

## Discord Integration

### Posting Timeline Updates

The system now posts a new message for each update using `createStatusMessage` from `src/discord/api.js`. The `formatDiscordMessage` function in `src/discord/embeds.js` handles the formatting based on the final schema and themes.

(Remove outdated `postStatusToDiscord` and `formatStatusForDiscord` snippets as they are superseded by the actual implementation in `src/discord/api.js` and `src/discord/embeds.js`).

## Utility Functions

### Getting User Status History

```javascript
// See src/storage/kv.js for the final implementation of getUserStatusHistory
// It now accepts kvStore as an argument.
export async function getUserStatusHistory(userId, kvStore, limit = 0) {
  // ... implementation ...
}
```

// Remove outdated "Getting User's Status Channel" section as channel is configured globally.

## Performance Considerations

### Efficient Storage

- Use compressed JSON when storing large histories
- Consider time-bucketed storage for very active users
- Implement automatic pruning of old status data

### Optimizing LLM Calls

- Only include relevant prior context
- Cache LLM results for similar inputs
- Implement retry logic with exponential backoff

### Rate Limiting

- Implement per-user rate limits
- Add cooldown periods for rapid updaters
- Queue updates during high-traffic periods
