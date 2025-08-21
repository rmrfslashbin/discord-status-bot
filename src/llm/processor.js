// src/llm/processor.js - LLM integration with context awareness

import { callAnthropicAPI } from './anthropic.js'
import { callOpenAIAPI } from './openai.js'
import { callOpenRouterAPI } from './openrouter.js'
// Context relevance functions are typically applied *before* calling the LLM processor
// import { calculateContextRelevance, filterRelevantContext } from './context.js';
import { createLogger } from '../utils/logger.js'

/**
 * Process status update with LLM, considering previous context.
 * @param {string} currentText - The user's current status narrative.
 * @param {Configuration} configInstance - Application configuration instance.
 * @param {Object | null} previousStatus - The *filtered* previous status object (optional).
 *                                         Should contain { timestamp, raw_input, processed_status }.
 * @returns {Promise<Object>} - Processed status data adhering to the new dynamic schema.
 */
export async function processWithLLM(currentText, configInstance, previousStatus = null) {
  const logger = createLogger('llm-processor')

  // Create the context-aware system prompt based on the new design
  const systemPrompt = createContextAwarePrompt(previousStatus)

  // Format the user input, including previous context if available
  const userInput = formatUserInput(currentText, previousStatus)

  try {
    // Choose the appropriate LLM service
    let resultJsonString // Expecting a JSON string from the API callers
    const service = configInstance.getValue('llm.service')
    const config = configInstance.get() // Get the raw config object for API calls

    logger.info('Processing status update with LLM', {
      service,
      contextProvided: !!previousStatus,
      inputLength: currentText.length,
    })

    // Call the selected LLM API
    switch (service) {
      case 'anthropic':
        // Assuming API functions accept (systemPrompt, userText, configObject)
        resultJsonString = await callAnthropicAPI(systemPrompt, userInput, config)
        break
      case 'openai':
        resultJsonString = await callOpenAIAPI(systemPrompt, userInput, config)
        break
      case 'openrouter':
        resultJsonString = await callOpenRouterAPI(systemPrompt, userInput, config)
        break
      default:
        logger.error('Unknown LLM service configured', { service })
        throw new Error(`Unknown LLM service configured: ${service}`)
    }

    // Validate and parse the JSON string according to the *new* schema
    return validateAndRepairStatusJSON(resultJsonString, currentText, logger)
  } catch (error) {
    logger.error('Error processing with LLM', { error: error })
    // Fallback to a default status (matching the new schema) if LLM processing fails
    return createDefaultStatus(currentText, `LLM Error: ${error.message}`)
  }
}

/**
 * Create the context-aware system prompt based on the design document.
 * @param {Object | null} previousStatus - Filtered previous status data (optional).
 * @returns {string} - System prompt for the LLM.
 */
function createContextAwarePrompt(previousStatus) {
  const prompt = `Transform status text into structured dashboard data. Extract metrics, personal states, highlights.

Personal states: 😈(arousal), 😴(tired), 🍽️(hunger), 🥤(thirst), 🧠(boredom), 🫂(lonely), 🎮(entertainment), 🌿(stress)
Rating: 1-5 scale. Time format: "2h", "3d", "now"
Trends: improved|worsened|unchanged|new

${previousStatus ? 'Context: Update/carry-forward relevant items. Physical states decay faster than emotional. Mark contradictions.' : ''}

JSON schema:
{
  "overall_status": "Brief status phrase",
  "mood_emoji": "Single mood emoji",
  "visual_theme": "work|gaming|social|rest|creative|learning|default",
  "accent_color": "Hex color or name",
  "metrics": [{"name": "str", "value": "str", "value_rating": 1-5, "trend": "improved|worsened|unchanged|new", "icon": "emoji"}],
  "highlights": [{"type": "activity|event|state|need|achievement|blocker", "description": "str", "timeframe": "past|current|future|ongoing", "is_new": true/false}],
  "persistent_context": [{"description": "str", "from_previous": true, "source_timestamp": "ISO"}],
  "personal_states": [{"name": "str", "emoji": "emoji", "level": 1-5, "time_since_last": "str", "trend": "increasing|decreasing|stable|new"}],
  "narrative_summary": "1-2 sentence summary",
  "errors": ["error strings or empty array"]
}

Return ONLY valid JSON. Use empty arrays [] if no items. Report errors in "errors" field only.`

  return prompt
}

/**
 * Format the user input string for the LLM, including previous context if available.
 * @param {string} currentText - Current status text from the user.
 * @param {Object | null} previousStatus - Filtered previous status data (optional).
 * @returns {string} - Formatted user input string.
 */
function formatUserInput(currentText, previousStatus) {
  let userInput = ''

  if (previousStatus && previousStatus.timestamp && previousStatus.processed_status) {
    // Include the timestamp and a summary/key parts of the *filtered* previous status
    const prevTimestamp = new Date(previousStatus.timestamp).toISOString()
    userInput += `PREVIOUS STATUS CONTEXT (from ${prevTimestamp}):\n`
    // Stringify the relevant parts of the *processed* status from the previous entry
    // Avoid stringifying the entire raw input again.
    userInput += `\`\`\`json\n${JSON.stringify(previousStatus.processed_status, null, 2)}\n\`\`\`\n\n`
    userInput += `PREVIOUS RAW INPUT (from ${prevTimestamp}):\n${previousStatus.raw_input}\n\n`
  } else {
    userInput += 'PREVIOUS STATUS CONTEXT: None provided.\n\n'
  }

  // Add current time context
  const currentTimeISO = new Date().toISOString()
  userInput += `CURRENT TIME (UTC): ${currentTimeISO}\n\n`

  userInput += 'CURRENT STATUS UPDATE:\n' // Removed the timestamp from here as it's now above
  userInput += currentText

  return userInput
}

/**
 * Validate, parse, and potentially repair JSON string from LLM according to the NEW schema.
 * @param {string} jsonString - Raw string response from LLM (expected to be JSON).
 * @param {string} originalText - Original user text for fallback summary.
 * @param {Logger} logger - Logger instance for structured logging.
 * @returns {Object} - Validated JSON object matching the new schema or a default status object.
 */
function validateAndRepairStatusJSON(jsonString, originalText, logger) {
  if (typeof jsonString !== 'string' || jsonString.trim() === '') {
    logger.error('LLM returned empty or non-string response')
    // Use the updated createDefaultStatus function
    return createDefaultStatus(originalText, 'LLM returned empty response.')
  }

  try {
    // First attempt: Parse directly
    const parsed = JSON.parse(jsonString)
    logger.debug('Successfully parsed LLM JSON response')
    // Basic schema validation could be added here if needed
    return parsed
  } catch (parseError) {
    logger.warn('Initial JSON parsing failed', { error: parseError.message })
    // Attempt to extract JSON from potential markdown code blocks or text wrapping
    const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/)
    if (jsonMatch) {
      // Prioritize explicit JSON block (match[1]), fallback to generic object match (match[2])
      const extractedJson = jsonMatch[1] || jsonMatch[2]
      if (extractedJson) {
        try {
          const repairedParsed = JSON.parse(extractedJson)
          logger.info('Successfully parsed JSON after extraction')
          // Basic schema validation could be added here
          return repairedParsed
        } catch (repairError) {
          logger.error('Failed to parse JSON even after extraction', {
            error: repairError.message,
          })
          // Use the updated createDefaultStatus function
          return createDefaultStatus(originalText, 'LLM response was malformed JSON.')
        }
      }
    }

    // No valid JSON found after attempts
    logger.error('No valid JSON found in LLM response after repair attempts')
    // Use the updated createDefaultStatus function
    return createDefaultStatus(originalText, 'LLM response did not contain valid JSON.')
  }
  // TODO: Add schema validation here to ensure the parsed object matches the expected structure.
  // This could involve checking for required fields, types, and array structures.
}

/**
 * Create a default status object (matching the NEW schema) when LLM processing fails.
 * @param {string} text - The original status text.
 * @param {string} [reason="Processing failed"] - Reason for fallback.
 * @returns {Object} - A default status object adhering to the new schema.
 */
function createDefaultStatus(text, reason = 'Processing failed') {
  const logger = createLogger('llm-processor')
  logger.warn('Creating default status', { reason })
  // Fallback summary for potential future use
  // const fallbackSummary = `Status update received, but automatic analysis failed (${reason}). Original text: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`

  // Return a structure matching the new JSON schema defined in createContextAwarePrompt
  return {
    overall_status: 'Analysis Failed',
    mood_emoji: '⚠️',
    visual_theme: 'default',
    accent_color: '#FEE75C', // Yellow for warning
    metrics: [
      {
        name: 'Processing Status',
        value: 'Failed',
        value_rating: 1,
        trend: 'new',
        icon: '⚙️',
      },
    ],
    highlights: [
      {
        type: 'state',
        description: `Failed to analyze status update. Reason: ${reason}`,
        timeframe: 'current',
        is_new: true,
      },
    ],
    persistent_context: [],
    narrative_summary: `Analysis failed. ${reason}`, // Keep summary concise
    errors: [`LLM Processing Error: ${reason}`], // Clearly state the error source and reason
    // Add the new personal_states field
    personal_states: [],
  }
}
