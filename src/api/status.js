// src/api/status.js - Core status update processing logic with context awareness

import { processWithLLM } from '../llm/processor.js'
import { formatDiscordMessage } from '../discord/embeds.js'
import { createStatusMessage } from '../discord/api.js'
// Import KV storage functions for history/latest status
import { storeUserStatus, getUserStatusHistory } from '../storage/kv.js'
// Import profile storage functions
import { getUserProfile } from '../storage/profile.js'
// Import context relevance and time tracking functions
import { calculateContextRelevance, filterRelevantContext, updatePersonalStateTimes } from '../llm/context.js'
// Import activity creation function
import { createActivity } from '../storage/activity.js'
// Import structured logging
import { createRequestLogger } from '../utils/logger.js'
// Import validation utilities
import { ValidationError } from '../utils/errors.js'
import { InputValidator } from '../utils/validation.js'

// JSDoc type imports for documentation
/** @typedef {import('../types.js').StatusData} StatusData */
/** @typedef {import('../types.js').StatusEntry} StatusEntry */
/** @typedef {import('../types.js').UserProfile} UserProfile */
/** @typedef {import('../types.js').Configuration} Configuration */
/** @typedef {import('../types.js').Logger} Logger */
/** @typedef {import('../types.js').StatusUpdateResponse} StatusUpdateResponse */

/**
 * Core function to process a status update request with context awareness.
 * Fetches previous status, calculates relevance, filters context, processes with LLM,
 * stores new status, formats, and posts a *new* Discord message.
 * @param {string} statusText - The user's raw status narrative.
 * @param {string} userId - The Discord User ID of the person updating status.
 * @param {Configuration} configInstance - The application configuration instance.
 * @returns {Promise<string>} - The Discord message ID of the updated/created status message.
 * @throws {Error} - Throws errors if critical steps fail (e.g., config missing, Discord API fails).
 */
export async function processStatusUpdate(statusText, userId, configInstance) {
  // Create request logger with trace ID
  const logger = createRequestLogger(userId, 'status-processor', {
    statusTextLength: statusText?.length || 0,
  })

  if (!userId) {
    logger.error('User ID is required to process status update')
    throw new Error('User ID is required to process status update.')
  }
  if (!statusText || typeof statusText !== 'string' || statusText.trim() === '') {
    logger.error('Status text cannot be empty', { statusText })
    throw new Error('Status text cannot be empty.')
  }

  logger.info('Starting context-aware status update process')

  try {
    // 1. Get necessary configuration
    const channelId = configInstance.getValue('discord.statusChannelId')
    const historyLimit = configInstance.getValue('storage.historyLimit', 3) // Get history limit from config or default
    const relevanceThreshold = configInstance.getValue('llm.relevanceThreshold', 0.3) // Get threshold from config or default

    if (!channelId) {
      logger.error('Status channel ID not configured')
      throw new Error('Status channel ID (STATUS_CHANNEL_ID) is not configured.')
    }

    // --- Retrieve KV Store Binding ---
    // Get KV Store binding early to pass to storage functions
    const kvStore = configInstance.getKvBinding()
    if (!kvStore) {
      // Throw error immediately if storage is unavailable
      logger.error('KV Store binding not available')
      throw new Error('KV Store binding not available in processStatusUpdate')
    } else {
      logger.debug('Successfully retrieved KV Store binding')
    }
    // --- End KV Store Binding Retrieval ---

    // 2. Get the previous status entries for context, limiting to 3 most recent
    logger.info('Fetching recent status history for context', { historyLimit })
    const recentHistory = await getUserStatusHistory(userId, kvStore, historyLimit)
    let filteredContext = null

    // 3. Calculate relevance and filter context if previous status exists
    if (recentHistory && recentHistory.length > 0) {
      // Use the most recent status entry for primary context
      const mostRecentStatus = recentHistory[0]
      logger.info('Calculating context relevance', {
        previousTimestamp: mostRecentStatus.timestamp,
        historyCount: recentHistory.length,
        relevanceThreshold,
      })

      // Calculate relevance for the most recent entry
      const contextWithRelevance = calculateContextRelevance(mostRecentStatus)
      logger.debug('Filtering relevant context')
      filteredContext = filterRelevantContext(contextWithRelevance, relevanceThreshold)

      // Add context from other recent entries if they contain highly relevant information
      if (recentHistory.length > 1) {
        const additionalContext = extractRelevantFromHistory(recentHistory.slice(1), relevanceThreshold)
        if (additionalContext.length > 0) {
          logger.debug('Adding additional context from history', { count: additionalContext.length })
          filteredContext = mergeHistoricalContext(filteredContext, additionalContext)
        }
      }
    } else {
      logger.info('No previous status found for context')
    }

    // 4. Process the status text with the LLM, providing filtered context
    logger.info('Processing text with LLM', { contextProvided: !!filteredContext })
    // Pass the filtered context object (which includes timestamp, raw_input, and filtered processed_status)
    const newStatusData = await processWithLLM(statusText, configInstance, filteredContext)
    logger.info('LLM processing complete', { overallStatus: newStatusData.overall_status })

    // 4b. Update personal state time tracking using previous context
    const mostRecentStatus = filteredContext || recentHistory?.[0]
    if (mostRecentStatus && mostRecentStatus.processed_status) {
      logger.debug('Updating personal state time tracking')
      // Ensure personal_states exists on both, defaulting to empty arrays
      const prevPersonalStates = mostRecentStatus.processed_status.personal_states || []
      const currentPersonalStates = newStatusData.personal_states || []
      newStatusData.personal_states = updatePersonalStateTimes(
        prevPersonalStates,
        currentPersonalStates,
        mostRecentStatus.timestamp, // Pass the timestamp of the previous status
      )
    } else {
      // If no previous status, ensure trend is 'new' if states exist
      if (newStatusData.personal_states && Array.isArray(newStatusData.personal_states)) {
        newStatusData.personal_states.forEach(state => state.trend = 'new')
      }
    }

    // 5. Store the new status entry (raw input + processed output with updated times/trends)
    logger.info('Storing new status entry')
    // Call uses the kvStore variable defined earlier
    const storedStatusEntry = await storeUserStatus(userId, statusText, newStatusData, kvStore, historyLimit)
    if (!storedStatusEntry) {
      // Log error but proceed with posting the message if possible
      // Error logging now happens inside storeUserStatus
      logger.error('Failed to store status, proceeding with message post')
    } else {
      logger.info('Successfully stored new status', { timestamp: storedStatusEntry.timestamp })
    }

    // 5b. Load user profile for custom emojis and preferences
    logger.debug('Loading user profile for custom emojis')
    // Call uses the kvStore variable defined earlier
    const userProfile = await getUserProfile(userId, kvStore)

    // 5c. Apply custom emojis to the processed status data
    const finalStatusData = applyCustomEmojis(newStatusData, userProfile.custom_emojis)
    logger.debug('Applied custom emojis')

    // 5d. Check for potential activity and create it
    let activityId = null
    const activityHighlight = finalStatusData.highlights?.find(h =>
      h.type === 'activity' && (h.timeframe === 'current' || h.timeframe === 'future'),
    )
    if (activityHighlight) {
      logger.info('Found potential activity highlight', {
        activityDescription: activityHighlight.description,
      })
      activityId = await createActivity(
        userId,
        {
          title: activityHighlight.description,
          description: finalStatusData.narrative_summary || '',
          type: finalStatusData.visual_theme || 'general',
        },
        kvStore, // Pass kvStore
      )
      if (activityId) {
        logger.info('Created activity', { activityId })
        // Add activityId to status data *only for passing to formatter*, don't store it in KV status history
        finalStatusData.activity_id = activityId
      } else {
        logger.error('Failed to create activity')
      }
    }

    // 6. Format the *final* structured data into a Discord message payload
    // Pass the final status data, previous status, user profile, and trace ID
    const messagePayload = formatDiscordMessage(finalStatusData, userId, mostRecentStatus, userProfile, logger.getTraceId())
    logger.debug('Formatted Discord message payload')

    // 7. Always create a new message (POST)
    logger.info('Creating new Discord message', { channelId })
    const newMessageId = await createStatusMessage(channelId, messagePayload, configInstance)
    logger.info('Discord message created successfully', {
      messageId: newMessageId,
      traceId: logger.getTraceId(),
    })

    return newMessageId // Return the ID of the newly created message
  } catch (error) {
    logger.error('Error during status update process', {
      error: error,
      statusTextLength: statusText?.length,
      traceId: logger.getTraceId(),
    })
    // Re-throw the error to be handled by the calling context (e.g., interaction handler, webhook handler)
    // This allows sending appropriate feedback to the user.
    throw error // Add more specific error context if needed
  }
}

/**
 * Extract highly relevant context from historical status entries
 * @param {Array} historyEntries - Array of status entries (excluding most recent)
 * @param {number} threshold - Relevance threshold (typically higher than normal)
 * @returns {Array} - Array of relevant context items from history
 */
function extractRelevantFromHistory(historyEntries, threshold = 0.5) {
  const relevantContext = []

  // Use a higher threshold for historical context to avoid noise
  const historyThreshold = Math.max(threshold * 1.5, 0.5)

  for (const entry of historyEntries) {
    if (!entry || !entry.processed_status) continue

    try {
      // Calculate relevance for this historical entry
      const contextWithRelevance = calculateContextRelevance(entry)
      if (!contextWithRelevance) continue

      // Extract highly relevant items only
      const filteredEntry = filterRelevantContext(contextWithRelevance, historyThreshold)
      if (!filteredEntry || !filteredEntry.processed_status) continue

      // Add relevant metrics and highlights with source timestamp
      const { metrics = [], highlights = [], persistent_context = [] } = filteredEntry.processed_status

      // Only include items that have strong relevance scores
      const highlyRelevantMetrics = metrics.filter(m => m.relevance_score >= historyThreshold)
      const highlyRelevantHighlights = highlights.filter(h => h.relevance_score >= historyThreshold)
      const highlyRelevantContext = persistent_context.filter(p => p.relevance_score >= historyThreshold)

      if (highlyRelevantMetrics.length > 0 || highlyRelevantHighlights.length > 0 || highlyRelevantContext.length > 0) {
        relevantContext.push({
          timestamp: entry.timestamp,
          metrics: highlyRelevantMetrics,
          highlights: highlyRelevantHighlights,
          persistent_context: highlyRelevantContext,
        })
      }
    } catch (error) {
      console.warn('Error extracting context from historical entry:', error)
      // Continue with other entries
    }
  }

  return relevantContext
}

/**
 * Merge additional historical context into the primary filtered context
 * @param {Object} primaryContext - Primary context from most recent status
 * @param {Array} additionalContext - Additional context from historical entries
 * @returns {Object} - Merged context object
 */
function mergeHistoricalContext(primaryContext, additionalContext) {
  if (!primaryContext || !primaryContext.processed_status) {
    return primaryContext
  }

  // Start with the primary context
  const merged = JSON.parse(JSON.stringify(primaryContext)) // Deep copy

  // Collect additional persistent context items
  const additionalPersistentContext = []

  for (const contextEntry of additionalContext) {
    // Add highly relevant persistent context from history
    for (const persistentItem of contextEntry.persistent_context || []) {
      additionalPersistentContext.push({
        ...persistentItem,
        from_previous: true,
        source_timestamp: contextEntry.timestamp,
      })
    }

    // Add highly relevant metrics as persistent context (converted)
    for (const metric of contextEntry.metrics || []) {
      if (metric.relevance_score >= 0.7) { // Very high threshold for metrics to become persistent context
        additionalPersistentContext.push({
          description: `Previous ${metric.name}: ${metric.value} (${metric.trend})`,
          from_previous: true,
          source_timestamp: contextEntry.timestamp,
          relevance_score: metric.relevance_score,
        })
      }
    }
  }

  // Merge additional persistent context, avoiding duplicates
  const existingDescriptions = new Set(
    (merged.processed_status.persistent_context || []).map(p => p.description),
  )

  for (const item of additionalPersistentContext) {
    if (!existingDescriptions.has(item.description)) {
      merged.processed_status.persistent_context = merged.processed_status.persistent_context || []
      merged.processed_status.persistent_context.push(item)
      existingDescriptions.add(item.description)
    }
  }

  return merged
}

/**
 * Apply custom emojis from user profile to status data.
 * @param {StatusData} statusData - Status data object from LLM processing.
 * @param {Object.<string, string>} [customEmojis] - The user's custom_emojis map { stateName: emoji }.
 * @returns {StatusData} - Status data object with emojis potentially replaced.
 */
function applyCustomEmojis(statusData, customEmojis) {
  // Skip if no custom emojis or empty status data
  if (!customEmojis || Object.keys(customEmojis).length === 0 || !statusData) {
    return statusData
  }

  // Create a *deep copy* to avoid modifying the original LLM output object
  // which might be stored in history before this step.
  const updatedStatus = JSON.parse(JSON.stringify(statusData))

  // Helper to get lowercase state name for matching
  const lower = str => (str || '').toLowerCase()

  // Replace emoji in mood_emoji if applicable
  // Assuming 'mood' is the key for the main mood emoji in customEmojis
  if (updatedStatus.mood_emoji && customEmojis['mood']) {
    updatedStatus.mood_emoji = customEmojis['mood']
  }

  // Replace emojis in metrics
  if (updatedStatus.metrics && Array.isArray(updatedStatus.metrics)) {
    updatedStatus.metrics = updatedStatus.metrics.map(metric => {
      const metricNameLower = lower(metric.name)
      if (customEmojis[metricNameLower]) {
        return { ...metric, icon: customEmojis[metricNameLower] }
      }
      return metric
    })
  }

  // Replace emojis in personal states
  if (updatedStatus.personal_states && Array.isArray(updatedStatus.personal_states)) {
    updatedStatus.personal_states = updatedStatus.personal_states.map(state => {
      const stateNameLower = lower(state.name)
      if (customEmojis[stateNameLower]) {
        return { ...state, emoji: customEmojis[stateNameLower] }
      }
      return state
    })
  }

  return updatedStatus
}

/**
 * Handle direct status update requests via a specific API endpoint (e.g., /update-status)
 * Useful for testing, debugging, or integration with other systems.
 * Expects a POST request with JSON body: { "statusText": "...", "userId": "..." }
 * @param {Request} request - The incoming HTTP request object.
 * @param {Object} context - The request context containing the config instance.
 * @returns {Promise<Response>} - An HTTP Response object.
 */
export async function handleDirectStatusUpdate(request, context) {
  const { config } = context
  const logger = createRequestLogger('direct-api', 'direct-status-update')

  if (request.method !== 'POST') {
    logger.warn('Invalid HTTP method', { method: request.method })
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // Ensure content type is application/json
    if (!request.headers.get('content-type')?.includes('application/json')) {
      logger.warn('Invalid content type', {
        contentType: request.headers.get('content-type'),
      })
      return new Response('Bad Request: Content-Type must be application/json', { status: 400 })
    }

    const { statusText, userId } = await request.json()

    // Validate input using comprehensive validation
    let validatedStatusText, validatedUserId
    const validator = new InputValidator(logger)
    try {
      validatedUserId = validator.validateUserId(userId, 'userId')
      validatedStatusText = validator.validateStatusText(statusText, 'statusText', 2000)
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn('Input validation failed', {
          field: error.field,
          code: error.code,
          message: error.message,
        })
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: error.message,
            field: error.field,
            code: error.code,
            traceId: logger.getTraceId(),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      } else {
        logger.error('Unexpected validation error', { error })
        return new Response('Bad Request: Invalid input parameters.', { status: 400 })
      }
    }

    // Update logger to include actual validated userId
    logger.context.userId = validatedUserId
    logger.info('Received direct status update request')

    // Process the update using the core function with validated inputs
    const messageId = await processStatusUpdate(validatedStatusText, validatedUserId, config)

    logger.info('Direct status update completed successfully', {
      messageId,
      traceId: logger.getTraceId(),
    })

    // Return a success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Status updated successfully.',
      userId: validatedUserId,
      messageId: messageId,
      traceId: logger.getTraceId(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('Error handling direct status update request', {
      error: error,
      traceId: logger.getTraceId(),
    })
    // Return an error response
    return new Response(JSON.stringify({
      success: false,
      message: `Error updating status: ${error.message}`,
      traceId: logger.getTraceId(),
    }), {
      status: 500, // Internal Server Error
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
