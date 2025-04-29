# LLM API Integration Guide

This document provides detailed instructions for integrating with different LLM APIs for the Discord Status Dashboard.

## API Selection Considerations

When selecting which LLM API to use, consider these factors:
- **Cost**: Pricing models vary significantly between providers
- **Performance**: Response quality and consistency differs by model
- **Latency**: Some APIs respond faster than others
- **JSON reliability**: Some models are better at producing valid JSON consistently

## Anthropic Claude Integration

### Overview
Anthropic's Claude models are excellent at following structured output instructions and provide high-quality analysis of user text.

### API Setup
1. Create an account at [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys and create a new key
3. Store this key securely in your environment variables

### API Call Format

```javascript
async function callAnthropicAPI(systemPrompt, userText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Faster, cheaper option
      // Alternative: 'claude-3-opus-20240229' for highest quality
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }
  
  const result = await response.json();
  return JSON.parse(result.content[0].text);
}
```

### Error Handling
Common errors include:
- 401: Invalid API key
- 429: Rate limit exceeded
- 500: Internal server error

Implement exponential backoff for retries on 429 errors.

## OpenAI Integration

### Overview
OpenAI's GPT models can effectively process status updates, with newer models having excellent JSON output capabilities.

### API Setup
1. Create an account at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to API Keys and create a new key
3. Store this key securely in your environment variables

### API Call Format

```javascript
async function callOpenAIAPI(systemPrompt, userText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_API_KEY`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo', // Cost-effective option
      // Alternative: 'gpt-4' for highest quality
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}
```

### Error Handling
Common errors include:
- 401: Invalid API key
- 429: Rate limit exceeded
- 500: Internal server error

Implement exponential backoff for retries on 429 errors.

## OpenRouter Integration

### Overview
OpenRouter provides access to multiple LLM models through a single API, allowing for flexibility in model selection.

### API Setup
1. Create an account at [OpenRouter](https://openrouter.ai/)
2. Generate an API key
3. Store this key securely in your environment variables

### API Call Format

```javascript
async function callOpenRouterAPI(systemPrompt, userText) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_API_KEY`,
      'HTTP-Referer': 'https://your-app-domain.com' // Required by OpenRouter
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku', // Many options available
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }
  
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}
```

## JSON Validation and Error Recovery

Always validate the JSON output from any LLM:

```javascript
function validateAndRepairStatusJSON(jsonString) {
  try {
    // First attempt to parse as-is
    return JSON.parse(jsonString);
  } catch (parseError) {
    // Try to extract JSON from potential text wrapping
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        // Still invalid, fall back to default
        console.error('Failed to parse JSON after extraction attempt');
        return createDefaultStatus();
      }
    }
    
    // No valid JSON found
    console.error('No valid JSON found in response');
    return createDefaultStatus();
  }
}
```

## Cost Optimization

To optimize costs while maintaining quality:
1. Use smaller models for faster, cheaper processing (Claude Haiku vs Opus)
2. Implement caching for similar status updates
3. Set appropriate max_tokens to prevent unnecessary generation
4. Consider implementing a user quota system

## Testing LLM Responses

Before full deployment, test each LLM with various inputs:
- Very short status updates
- Very long, detailed updates
- Updates with unusual formatting
- Updates with ambiguous meaning

Record the JSON outputs and ensure they're consistently valid and appropriate.
