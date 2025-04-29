# Configuration Best Practices for Cloudflare Workers

This document outlines best practices for managing configuration in the Discord Status Dashboard application when deployed as a Cloudflare Worker.

## Environment Variable Management

### Sensitive Information
Always store sensitive information in environment variables or secrets:
- API keys (Discord, LLM services)
- Authentication tokens
- Webhook URLs
- Private keys

### Using Wrangler Secrets
For sensitive configuration, use Wrangler secrets which are encrypted at rest:

```bash
# Adding secrets via command line
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put LLM_API_KEY
wrangler secret put DISCORD_PUBLIC_KEY
```

These values can then be accessed within the worker code as global variables.

### Environment-Specific Configuration
Use `wrangler.toml` for environment-specific, non-sensitive configuration:

```toml
[env.production]
vars = { 
  ENVIRONMENT = "production",
  LLM_SERVICE = "anthropic",
  LLM_MODEL = "claude-3-haiku-20240307",
  DISCORD_API_VERSION = "v10"
}

[env.staging]
vars = { 
  ENVIRONMENT = "staging", 
  LLM_SERVICE = "openai",
  LLM_MODEL = "gpt-3.5-turbo",
  DISCORD_API_VERSION = "v10"
}
```

## KV Storage for Dynamic Configuration

Use Cloudflare KV for storing configuration that may change at runtime:

### KV Namespace Setup
```toml
# In wrangler.toml
[[kv_namespaces]]
binding = "STATUS_BOT_STORAGE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

### Storing Configuration Values
Use KV for values like:
- Discord message IDs (per user)
- Channel mappings
- User preferences
- Feature flags

### Configuration Access Patterns
```javascript
// Read configuration
async function getConfig(key, defaultValue) {
  try {
    const value = await STATUS_BOT_STORAGE.get(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`Error retrieving config for ${key}:`, error);
    return defaultValue;
  }
}

// Update configuration
async function setConfig(key, value) {
  try {
    await STATUS_BOT_STORAGE.put(key, value);
    return true;
  } catch (error) {
    console.error(`Error storing config for ${key}:`, error);
    return false;
  }
}

// Example usage:
const messageId = await getConfig(`status_message:${userId}`, null);
```

## Configuration Loading Pattern

### Centralized Configuration Module
Create a dedicated module for configuration management:

```javascript
// src/config.js

// Define constants within the module scope
const VERSION = '1.0.0'; // Example version
const BUILD_ID = 'phase3-complete-20250429c'; // Current build ID

export class Configuration {
  // Default configuration that can be overridden
  static defaults = {
    discord: {
      apiEndpoint: 'https://discord.com/api/v10',
      applicationId: '',
      publicKey: '',
      botToken: '',
      statusChannelId: '',
    },
    llm: {
      service: 'anthropic', 
      model: '',
      maxTokens: 1000,
      temperature: 0.1,
      anthropicEndpoint: 'https://api.anthropic.com/v1/messages',
      openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
      openrouterEndpoint: 'https://openrouter.ai/api/v1/chat/completions'
    }
  };
  
  // Instance configuration
  #config = { ...Configuration.defaults };
  
  // KV storage binding
  #storage = null;

  constructor(storage) {
    // The storage binding (e.g., STATUS_BOT_STORAGE) is passed in
    this.#storage = storage;
  }

  // Load all configuration from environment and KV
  async load(env) { // Accept env object
    // Load from environment variables first, passing env
    this.loadFromEnvironment(env);

    // Then load dynamic configuration from KV
    await this.loadFromKV();

    // Validate required configuration
    this.validate();

    return this.#config; // Return the config object, not the instance itself from load()
  }

  // Load configuration from environment variables passed via the env object
  loadFromEnvironment(env) {
    if (!env) {
        console.error("CRITICAL: env object not passed to loadFromEnvironment!");
        return;
    }
    // Environment
    this.#config.environment = env.ENVIRONMENT || 'development';

    // Discord configuration (Secrets read from env object)
    this.#config.discord.apiEndpoint = `https://discord.com/api/${env.DISCORD_API_VERSION || 'v10'}`;
    this.#config.discord.applicationId = env.DISCORD_APPLICATION_ID || ''; // From secret
    this.#config.discord.botToken = env.DISCORD_BOT_TOKEN || ''; // From secret
    // Vars (read from env object)
    this.#config.discord.publicKey = env.DISCORD_PUBLIC_KEY || ''; // From var
    this.#config.discord.statusChannelId = env.STATUS_CHANNEL_ID || ''; // From var

    // LLM configuration from single secret (provider, key) (read from env object)
    const llmCredentials = env.LLM_CREDENTIALS || '';
    if (llmCredentials && llmCredentials.includes(':')) {
        const parts = llmCredentials.split(':', 2);
        const provider = parts[0].toLowerCase().trim();
        const apiKey = parts[1].trim();
        if (['anthropic', 'openai', 'openrouter'].includes(provider) && apiKey) {
            this.#config.llm.service = provider;
            this.#config.llm.apiKey = apiKey;
        } else { this.#config.llm.apiKey = ''; }
    } else { this.#config.llm.apiKey = ''; }

    // Set default model based on service if LLM_MODEL var is not explicitly set (read from env object)
    this.#config.llm.model = env.LLM_MODEL ||
      (this.#config.llm.service === 'anthropic' ? 'claude-3-haiku-20240307' :
       this.#config.llm.service === 'openai' ? 'gpt-3.5-turbo' :
       'anthropic/claude-3-haiku');

    // Load other LLM settings from vars (read from env object)
    this.#config.llm.maxTokens = parseInt(env.LLM_MAX_TOKENS || Configuration.defaults.llm.maxTokens.toString(), 10);
    this.#config.llm.temperature = parseFloat(env.LLM_TEMPERATURE || Configuration.defaults.llm.temperature.toString());

    // Fallback for invalid numeric values
    if (isNaN(this.#config.llm.maxTokens)) this.#config.llm.maxTokens = Configuration.defaults.llm.maxTokens;
    if (isNaN(this.#config.llm.temperature)) this.#config.llm.temperature = Configuration.defaults.llm.temperature;

    return this.#config;
  }

  // Load dynamic configuration from KV
  async loadFromKV() {
    if (!this.#storage) return this.#config;
    
    try {
      // Load any dynamic configuration stored in KV
      const dynamicConfig = await this.#storage.get('app_config', { type: 'json' });
      if (dynamicConfig) {
        // Deep merge with existing configuration
        this.#deepMerge(this.#config, dynamicConfig);
      }
      
      // Load specific user message IDs or other dynamic parameters as needed
    } catch (error) {
      console.error('Error loading configuration from KV:', error);
    }
    
    return this.#config;
  }
  
  // Helper method for deep merging objects
  #deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        this.#deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
    return target;
  }
  
  // Get the full configuration object
  get() {
    return this.#config;
  }

  /**
   * Get the KV Namespace binding object stored during initialization.
   * @returns {KVNamespace | null} The KV binding or null if not set.
   */
  getKvBinding() {
    return this.#storage;
  }

  // --- Add getters for constants ---
  getVersion() {
    return VERSION;
  }

  getBuildId() {
    return BUILD_ID;
  }
  // --- End getters ---

  // Get a specific configuration value using dot notation path
  getValue(path, defaultValue = null) {
    return path.split('.').reduce((obj, key) => 
      (obj && obj[key] !== undefined) ? obj[key] : defaultValue, this.#config);
  }
  
  // Update a configuration value at runtime
  async setValue(path, value) {
    if (!this.#storage) return false;
    
    try {
      // Update in memory
      const keys = path.split('.');
      let current = this.#config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      // Persist to KV if appropriate
      // This example stores the entire config, but you could also
      // store specific keys depending on your needs
      await this.#storage.put('app_config', JSON.stringify(this.#config));
      
      return true;
    } catch (error) {
      console.error(`Error updating configuration at ${path}:`, error);
      return false;
    }
  }
}

// Usage example in src/index.js
export async function initializeConfig(kvBinding, env) { // Updated signature
  // Pass the actual binding to the constructor
  const config = new Configuration(kvBinding);
  // Pass the env object to the load method
  await config.load(env);
  return config; // Return the instance
}
```

## Feature Flags

Use KV to implement feature flags for gradual rollout or testing:

```javascript
async function isFeatureEnabled(featureName, userId = null) {
  try {
    // Check for user-specific override
    if (userId) {
      const userFeatures = await STATUS_BOT_STORAGE.get(`user_features:${userId}`, { type: 'json' });
      if (userFeatures && userFeatures[featureName] !== undefined) {
        return userFeatures[featureName];
      }
    }
    
    // Check global feature flag
    const globalFeatures = await STATUS_BOT_STORAGE.get('global_features', { type: 'json' });
    return globalFeatures && globalFeatures[featureName] === true;
  } catch (error) {
    console.error(`Error checking feature flag ${featureName}:`, error);
    return false;
  }
}
```

## API Endpoint Configuration

Define API endpoints in a central configuration file:

```javascript
// src/endpoints.js
export function getEndpoints(config) {
  return {
    discord: {
      api: `${config.getValue('discord.apiEndpoint')}`,
      webhook: `${config.getValue('discord.apiEndpoint')}/webhooks/${config.getValue('discord.applicationId')}`,
      channels: (channelId) => `${config.getValue('discord.apiEndpoint')}/channels/${channelId}`,
      messages: (channelId, messageId) => `${config.getValue('discord.apiEndpoint')}/channels/${channelId}/messages${messageId ? `/${messageId}` : ''}`,
    },
    llm: {
      anthropic: config.getValue('llm.anthropicEndpoint'),
      openai: config.getValue('llm.openaiEndpoint'),
      openrouter: config.getValue('llm.openrouterEndpoint'),
    }
  };
}
```

## Security Considerations

### Secrets Rotation
Implement a process for regular rotation of sensitive credentials:

```javascript
async function rotateCredentials() {
  // 1. Generate new credentials via external process
  // 2. Store new credentials in KV with timestamp
  await STATUS_BOT_STORAGE.put('credentials_rotation', JSON.stringify({
    previous: { 
      key: config.getValue('llm.apiKey'),
      validUntil: new Date(Date.now() + 86400000).toISOString() // 24h overlap
    },
    current: {
      key: NEW_API_KEY,
      activeFrom: new Date().toISOString()
    }
  }));
  
  // 3. Update config
  await config.setValue('llm.apiKey', NEW_API_KEY);
}
```

### Validation

Always validate configuration at startup:

```javascript
  // Validate essential configuration parameters
  validate() {
    // Define which config paths map to which env var/secret names and their source
    const requiredSecrets = {
        'discord.botToken': 'DISCORD_BOT_TOKEN',
        'discord.applicationId': 'DISCORD_APPLICATION_ID',
        'llm.apiKey': 'LLM_CREDENTIALS' // Check derived value, source is secret
    };
    const requiredVars = {
        'discord.publicKey': 'DISCORD_PUBLIC_KEY',
        'discord.statusChannelId': 'STATUS_CHANNEL_ID',
        'llm.model': 'LLM_MODEL'
    };
    const numericVars = {
        'llm.maxTokens': 'LLM_MAX_TOKENS',
        'llm.temperature': 'LLM_TEMPERATURE'
    };

    // Check required secrets
    const missingSecrets = Object.keys(requiredSecrets)
        .filter(path => !this.getValue(path))
        .map(path => `${requiredSecrets[path]} (secret)`);

    // Check required vars
    const missingVars = Object.keys(requiredVars)
        .filter(path => !this.getValue(path))
        .map(path => `${requiredVars[path]} (var)`);

    // Check numeric vars
    const invalidNumericVars = Object.keys(numericVars)
        .filter(path => typeof this.getValue(path) !== 'number' || isNaN(this.getValue(path)))
        .map(path => `${numericVars[path]} (var - must be number)`);

    // Combine all validation failures
    const allMissing = [...missingSecrets, ...missingVars, ...invalidNumericVars];

    if (allMissing.length > 0) {
      const errorMsg = `Missing or invalid critical configuration parameters: ${allMissing.join(', ')}. Check wrangler.toml vars and Cloudflare secrets.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    console.log('Configuration validated successfully.');
  }
```
