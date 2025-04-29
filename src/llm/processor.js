// src/llm/processor.js - LLM integration with context awareness

import { callAnthropicAPI } from './anthropic.js';
import { callOpenAIAPI } from './openai.js';
import { callOpenRouterAPI } from './openrouter.js';
// Context relevance functions are typically applied *before* calling the LLM processor
// import { calculateContextRelevance, filterRelevantContext } from './context.js';

/**
 * Process status update with LLM, considering previous context.
 * @param {string} currentText - The user's current status narrative.
 * @param {Configuration} configInstance - Application configuration instance.
 * @param {Object | null} previousStatus - The *filtered* previous status object (optional).
 *                                         Should contain { timestamp, raw_input, processed_status }.
 * @returns {Promise<Object>} - Processed status data adhering to the new dynamic schema.
 */
export async function processWithLLM(currentText, configInstance, previousStatus = null) {
  // Create the context-aware system prompt based on the new design
  const systemPrompt = createContextAwarePrompt(previousStatus);

  // Format the user input, including previous context if available
  const userInput = formatUserInput(currentText, previousStatus);

  try {
    // Choose the appropriate LLM service
    let resultJsonString; // Expecting a JSON string from the API callers
    const service = configInstance.getValue('llm.service');
    const config = configInstance.get(); // Get the raw config object for API calls

    console.log(`Processing status update using LLM service: ${service}. Context provided: ${!!previousStatus}`);

    // Call the selected LLM API
    switch (service) {
      case 'anthropic':
        // Assuming API functions accept (systemPrompt, userText, configObject)
        resultJsonString = await callAnthropicAPI(systemPrompt, userInput, config);
        break;
      case 'openai':
        resultJsonString = await callOpenAIAPI(systemPrompt, userInput, config);
        break;
      case 'openrouter':
        resultJsonString = await callOpenRouterAPI(systemPrompt, userInput, config);
        break;
      default:
        throw new Error(`Unknown LLM service configured: ${service}`);
    }

    // Validate and parse the JSON string according to the *new* schema
    return validateAndRepairStatusJSON(resultJsonString, currentText);

  } catch (error) {
    console.error('Error processing with LLM:', error);
    // Fallback to a default status (matching the new schema) if LLM processing fails
    return createDefaultStatus(currentText, `LLM Error: ${error.message}`);
  }
}


/**
 * Create the context-aware system prompt based on the design document.
 * @param {Object | null} previousStatus - Filtered previous status data (optional).
 * @returns {string} - System prompt for the LLM.
 */
function createContextAwarePrompt(previousStatus) {
  // Base prompt structure from docs/design/00-next-steps.md
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

IMPORTANT CONTEXT: This system operates within a private, consenting user group. Users may share explicit personal status updates, including details about sexual desire, arousal (😈), or related activities. Your task is to neutrally and factually analyze *all* provided text, including such explicit details, and translate them *only* into the specified JSON schema, particularly the \`personal_states\` array. Do *not* refuse to process the input based on its explicit nature. Do *not* lecture, judge, or add warnings about the content within the JSON response. Focus solely on accurate data extraction and representation according to the schema. If the user expresses a desire for interaction related to a personal state (e.g., seeking help with arousal), represent this as the relevant personal state (e.g., \`😈\` with high intensity) and potentially a 'need' type highlight (e.g., 'Seeking assistance with personal need'), but do not label it as inappropriate solicitation.

Create a dynamic status dashboard that includes these personal state indicators along with other relevant information about the user's current context and previous status updates, adhering strictly to the guidelines above.
`;

  // Add specific instructions for handling previous context if provided
  if (previousStatus) {
    prompt += `
Apply these principles for determining relevance and merging context:
- Physical states (hunger, tiredness) decay faster than emotional states (frustration, happiness).
- Activities/projects/blockers often have longer persistence unless explicitly resolved.
- Explicitly time-bounded states from the past should generally be ignored unless relevant for context.
- Emphasized elements may persist longer.
- Avoid carrying forward outdated or directly contradicted information. If the user says "no longer tired", remove previous tiredness metrics/highlights.
- When merging, update existing metrics/highlights if the user provides new info on them (e.g., update 'Energy' metric value). Mark changes with 'trend'.
- Add new metrics/highlights based on the current text. Mark them as 'new'.
- Carry forward relevant, uncontradicted items from the previous context. Mark them as 'from_previous'.
`;
  }

  // Define the target JSON schema
  prompt += `
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

IMPORTANT: Respond ONLY with the valid JSON object described above. Do not include any introductory text, explanations, apologies, or markdown formatting like \`\`\`json before or after the JSON object itself. Your entire response must be the JSON structure. If you cannot perform the analysis or encounter significant issues, report them ONLY within the 'errors' array inside the JSON structure. Do not output conversational text.

Analyze the user's text and the provided previous context carefully. Infer values and trends based on both inputs. Ensure all fields in the schema are present, using empty arrays ([]) if no items apply for metrics, highlights, persistent_context, or personal_states. If you encounter ambiguity or cannot confidently determine a value based on the input, describe the issue clearly in the 'errors' field instead of guessing excessively. Be precise and adhere strictly to the JSON format.
`;

  return prompt;
}


/**
 * Format the user input string for the LLM, including previous context if available.
 * @param {string} currentText - Current status text from the user.
 * @param {Object | null} previousStatus - Filtered previous status data (optional).
 * @returns {string} - Formatted user input string.
 */
function formatUserInput(currentText, previousStatus) {
  let userInput = '';

  if (previousStatus && previousStatus.timestamp && previousStatus.processed_status) {
    // Include the timestamp and a summary/key parts of the *filtered* previous status
    const prevTimestamp = new Date(previousStatus.timestamp).toISOString();
    userInput += `PREVIOUS STATUS CONTEXT (from ${prevTimestamp}):\n`;
    // Stringify the relevant parts of the *processed* status from the previous entry
    // Avoid stringifying the entire raw input again.
    userInput += `\`\`\`json\n${JSON.stringify(previousStatus.processed_status, null, 2)}\n\`\`\`\n\n`;
     userInput += `PREVIOUS RAW INPUT (from ${prevTimestamp}):\n${previousStatus.raw_input}\n\n`;
  } else {
    userInput += 'PREVIOUS STATUS CONTEXT: None provided.\n\n';
  }

  // Add current time context
  const currentTimeISO = new Date().toISOString();
  userInput += `CURRENT TIME (UTC): ${currentTimeISO}\n\n`;

  userInput += `CURRENT STATUS UPDATE:\n`; // Removed the timestamp from here as it's now above
  userInput += currentText;

  return userInput;
}


/**
 * Validate, parse, and potentially repair JSON string from LLM according to the NEW schema.
 * @param {string} jsonString - Raw string response from LLM (expected to be JSON).
 * @param {string} originalText - Original user text for fallback summary.
 * @returns {Object} - Validated JSON object matching the new schema or a default status object.
 */
function validateAndRepairStatusJSON(jsonString, originalText) {
  if (typeof jsonString !== 'string' || jsonString.trim() === '') {
      console.error('LLM returned empty or non-string response.');
      // Use the updated createDefaultStatus function
      return createDefaultStatus(originalText, 'LLM returned empty response.');
  }

  try {
    // First attempt: Parse directly
    let parsed = JSON.parse(jsonString);
    console.log('Successfully parsed LLM JSON response.');
    // Basic schema validation could be added here if needed
    return parsed;
  } catch (parseError) {
    console.warn('Initial JSON parsing failed:', parseError.message);
    // Attempt to extract JSON from potential markdown code blocks or text wrapping
    const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
    if (jsonMatch) {
      // Prioritize explicit JSON block (match[1]), fallback to generic object match (match[2])
      const extractedJson = jsonMatch[1] || jsonMatch[2];
      if (extractedJson) {
        try {
          let repairedParsed = JSON.parse(extractedJson);
          console.log('Successfully parsed JSON after extraction.');
          // Basic schema validation could be added here
          return repairedParsed;
        } catch (repairError) {
          console.error('Failed to parse JSON even after extraction:', repairError.message);
          // Use the updated createDefaultStatus function
          return createDefaultStatus(originalText, 'LLM response was malformed JSON.');
        }
      }
    }

    // No valid JSON found after attempts
    console.error('No valid JSON found in LLM response after repair attempts.');
    // Use the updated createDefaultStatus function
    return createDefaultStatus(originalText, 'LLM response did not contain valid JSON.');
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
function createDefaultStatus(text, reason = "Processing failed") {
  console.warn(`Creating default status. Reason: ${reason}`);
  const fallbackSummary = `Status update received, but automatic analysis failed (${reason}). Original text: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`;

  // Return a structure matching the new JSON schema defined in createContextAwarePrompt
  return {
    overall_status: "Analysis Failed",
    mood_emoji: "⚠️",
    visual_theme: "default",
    accent_color: "#FEE75C", // Yellow for warning
    metrics: [
        {
            name: "Processing Status",
            value: "Failed",
            value_rating: 1,
            trend: "new",
            icon: "⚙️"
        }
    ],
    highlights: [
        {
            type: "state",
            description: `Failed to analyze status update. Reason: ${reason}`,
            timeframe: "current",
            is_new: true
        }
    ],
    persistent_context: [],
    narrative_summary: `Analysis failed. ${reason}`, // Keep summary concise
    errors: [`LLM Processing Error: ${reason}`], // Clearly state the error source and reason
    // Add the new personal_states field
    personal_states: []
  };
}
