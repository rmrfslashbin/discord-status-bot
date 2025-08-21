// src/llm/anthropic.js - Anthropic Claude API integration

import { LLMApiError, ConfigurationError, TimeoutError } from '../utils/errors.js'

/**
 * Call Anthropic's Claude API
 * @param {string} systemPrompt - The system prompt
 * @param {string} userText - The user's status text
 * @param {Object} config - Raw application configuration object
 * @returns {Promise<string>} - Raw JSON string response from the API
 * @throws {LLMApiError|ConfigurationError|TimeoutError}
 */
export async function callAnthropicAPI(systemPrompt, userText, config) {
  const apiEndpoint = config.llm.anthropicEndpoint
  const apiKey = config.llm.apiKey
  const model = config.llm.model
  const maxTokens = config.llm.maxTokens
  const temperature = config.llm.temperature

  if (!apiKey) {
    throw new ConfigurationError('Anthropic API key not configured', 'MISSING_API_KEY', { provider: 'anthropic' })
  }
  if (!apiEndpoint) {
    throw new ConfigurationError('Anthropic API endpoint not configured', 'MISSING_ENDPOINT', { provider: 'anthropic' })
  }

  console.log(`Calling Anthropic API: ${model}`)

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', // Required header for Claude API
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt, // Use the 'system' parameter for system prompts
        messages: [
          // System prompt is now outside the messages array
          { role: 'user', content: userText },
        ],
        // Request JSON object output directly if supported by the model/API version
        // Note: Anthropic's direct JSON support might vary; the prompt enforces it.
        // As of recent updates, adding response_format might not be standard.
        // Relying on the prompt instruction "Respond ONLY with valid JSON..."
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Anthropic API Error (${response.status}): ${errorText}`)

      let apiResponse = null
      try {
        apiResponse = JSON.parse(errorText)
      } catch {
        // Error text is not JSON
        apiResponse = { message: errorText }
      }

      throw new LLMApiError(
        `Anthropic API error: ${response.status}`,
        'anthropic',
        response.status,
        apiResponse,
        'ANTHROPIC_API_ERROR',
      )
    }

    const result = await response.json()

    // Check if the response structure is as expected
    if (!result.content || !Array.isArray(result.content) || result.content.length === 0 || !result.content[0].text) {
      console.error('Unexpected response structure from Anthropic:', result)
      throw new LLMApiError(
        'Unexpected response structure from Anthropic API',
        'anthropic',
        200,
        result,
        'INVALID_RESPONSE_STRUCTURE',
      )
    }

    // Return the text content which should be the JSON string
    return result.content[0].text
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (error instanceof LLMApiError) {
      throw error // Re-throw our custom errors
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new TimeoutError('Network request to Anthropic API failed', null, 'anthropic-api', error)
    }

    // Unknown error
    throw new LLMApiError(
      `Unexpected error calling Anthropic API: ${error.message}`,
      'anthropic',
      null,
      null,
      'UNKNOWN_ERROR',
    )
  }
}
