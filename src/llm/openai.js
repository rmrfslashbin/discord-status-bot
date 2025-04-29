// src/llm/openai.js - OpenAI API integration

/**
 * Call OpenAI's API
 * @param {string} systemPrompt - The system prompt
 * @param {string} userText - The user's status text
 * @param {Object} config - Raw application configuration object
 * @returns {Promise<string>} - Raw JSON string response from the API
 */
export async function callOpenAIAPI(systemPrompt, userText, config) {
  const apiEndpoint = config.llm.openaiEndpoint;
  const apiKey = config.llm.apiKey;
  const model = config.llm.model;
  const maxTokens = config.llm.maxTokens;
  const temperature = config.llm.temperature;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  if (!apiEndpoint) {
      throw new Error('OpenAI API endpoint not configured');
  }

  console.log(`Calling OpenAI API: ${model}`);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      response_format: { type: 'json_object' } // Request JSON output
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API Error (${response.status}): ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();

  // Check response structure
  if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
      console.error('Unexpected response structure from OpenAI:', result);
      throw new Error('Unexpected response structure from OpenAI API');
  }

  // Return the message content which should be the JSON string
  return result.choices[0].message.content;
}
