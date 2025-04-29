// src/llm/openrouter.js - OpenRouter API integration

/**
 * Call OpenRouter API
 * @param {string} systemPrompt - The system prompt
 * @param {string} userText - The user's status text
 * @param {Object} config - Raw application configuration object
 * @returns {Promise<string>} - Raw JSON string response from the API
 */
export async function callOpenRouterAPI(systemPrompt, userText, config) {
  const apiEndpoint = config.llm.openrouterEndpoint;
  const apiKey = config.llm.apiKey;
  const model = config.llm.model; // Model identifier like 'anthropic/claude-3-haiku'
  const maxTokens = config.llm.maxTokens;
  const temperature = config.llm.temperature;

  // Define your app's URL for the HTTP-Referer header
  const appUrl = 'https://your-status-dashboard-app.com'; // Replace with your actual app URL or identifier
  const appTitle = 'DiscordStatusDashboard'; // Replace with your app's name

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }
  if (!apiEndpoint) {
      throw new Error('OpenRouter API endpoint not configured');
  }

  console.log(`Calling OpenRouter API: ${model}`);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': `${appUrl}`, // Required by OpenRouter
      'X-Title': `${appTitle}`     // Optional, but recommended
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      // Request JSON output if the underlying model supports it via OpenRouter's abstraction
      // Check OpenRouter docs for specifics per model; may need to rely on prompt.
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenRouter API Error (${response.status}): ${errorText}`);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();

  // Check response structure (similar to OpenAI)
  if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
      console.error('Unexpected response structure from OpenRouter:', result);
      throw new Error('Unexpected response structure from OpenRouter API');
  }

  // Return the message content which should be the JSON string
  return result.choices[0].message.content;
}
