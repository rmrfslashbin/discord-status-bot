// src/config.js - Configuration management

/**
 * Configuration class for managing application settings
 */

// Define constants within the module scope
const VERSION = '1.0.0'; // Example version
const BUILD_ID = 'v1.0.0-stable'; // Updated build ID

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
      apiKey: '', // Added apiKey here
      maxTokens: 1000,
      temperature: 0.1,
      anthropicEndpoint: 'https://api.anthropic.com/v1/messages',
      openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
      openrouterEndpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    environment: 'development' // Added environment tracking
  };

  // Instance configuration
  #config = JSON.parse(JSON.stringify(Configuration.defaults)); // Deep copy defaults

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

    return this.#config;
  }

  // Load configuration from environment variables passed via the env object
  loadFromEnvironment(env) {
    if (!env) {
        console.error("CRITICAL: env object not passed to loadFromEnvironment!");
        // Set defaults or throw an error, preventing validation failure later is tricky
        // For now, let validation handle missing values
        return;
    }
    // Environment
    this.#config.environment = env.ENVIRONMENT || 'development';

    // Discord configuration
    this.#config.discord.apiEndpoint =
      `https://discord.com/api/${env.DISCORD_API_VERSION || 'v10'}`;
    // Secrets (read from env object)
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
            console.log(`Loaded LLM provider "${provider}" from credentials.`);
        } else {
            console.error('Invalid format or unsupported provider in LLM_CREDENTIALS secret. Expected format: provider:api_key');
            // Keep default service but clear API key to force validation failure later
            this.#config.llm.apiKey = '';
        }
    } else {
        console.warn('LLM_CREDENTIALS secret not found or in incorrect format.');
        // Clear API key to force validation failure
        this.#config.llm.apiKey = '';
    }

    // Set default model based on service if LLM_MODEL var is not explicitly set (read from env object)
    // Ensure this runs *after* service is potentially set from credentials
    this.#config.llm.model = env.LLM_MODEL ||
      (this.#config.llm.service === 'anthropic' ? 'claude-3-haiku-20240307' :
       this.#config.llm.service === 'openai' ? 'gpt-3.5-turbo' :
       'anthropic/claude-3-haiku'); // Default for openrouter if LLM_MODEL var is not set

    // Load other LLM settings from vars (read from env object), using defaults if not set
    this.#config.llm.maxTokens = parseInt(env.LLM_MAX_TOKENS || Configuration.defaults.llm.maxTokens.toString(), 10); // From var
    this.#config.llm.temperature = parseFloat(env.LLM_TEMPERATURE || Configuration.defaults.llm.temperature.toString()); // From var

    // Ensure numeric values are valid after parsing vars, fallback to defaults if parsing failed
    if (isNaN(this.#config.llm.maxTokens)) {
        console.warn(`Invalid LLM_MAX_TOKENS value, using default: ${Configuration.defaults.llm.maxTokens}`);
        this.#config.llm.maxTokens = Configuration.defaults.llm.maxTokens;
    }
    if (isNaN(this.#config.llm.temperature)) {
        console.warn(`Invalid LLM_TEMPERATURE value, using default: ${Configuration.defaults.llm.temperature}`);
        this.#config.llm.temperature = Configuration.defaults.llm.temperature;
    }


    return this.#config;
  }

  // Load dynamic configuration from KV
  async loadFromKV() {
    if (!this.#storage) {
        console.warn('KV Storage not available, skipping load from KV.');
        return this.#config;
    }

    try {
      // Load any dynamic configuration stored in KV under a general key
      const dynamicConfig = await this.#storage.get('app_config', { type: 'json' });
      if (dynamicConfig) {
        // Deep merge with existing configuration
        this.#deepMerge(this.#config, dynamicConfig);
        console.log('Loaded dynamic configuration from KV.');
      } else {
        console.log('No dynamic configuration found in KV under "app_config".');
      }
    } catch (error) {
      console.error('Error loading configuration from KV:', error);
      // Decide if this should be fatal or just a warning
    }

    return this.#config;
  }

  // Helper method for deep merging objects
  #deepMerge(target, source) {
    for (const key in source) {
      // Ensure source property is not inherited
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
            targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          // If both target and source values are objects, recurse
          this.#deepMerge(targetValue, sourceValue);
        } else {
          // Otherwise, assign the source value to the target
          // Use Object.assign for potential future extensibility if needed, but direct assignment is fine
          target[key] = sourceValue;
        }
      }
    }
    return target; // Return target for chaining, though not used here
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
  getValue(path, defaultValue = undefined) {
    // Navigate the path, return defaultValue if any part is missing
    return path.split('.').reduce((obj, key) =>
      (obj && typeof obj === 'object' && key in obj) ? obj[key] : defaultValue, this.#config);
  }

  // Update a configuration value at runtime and persist to KV
  async setValue(path, value) {
    if (!this.#storage) {
        console.error('Cannot set value: KV Storage not available.');
        return false;
    }

    try {
      // Update in memory first
      const keys = path.split('.');
      let current = this.#config;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        // Create nested object if it doesn't exist
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = value;

      // Persist the *entire* configuration object to KV under 'app_config'
      // Consider if only persisting the changed part or the whole object is better.
      // Persisting the whole object is simpler but might overwrite concurrent changes
      // if not handled carefully.
      await this.#storage.put('app_config', JSON.stringify(this.#config));
      console.log(`Configuration updated in memory and persisted to KV at path: ${path}`);

      return true;
    } catch (error) {
      console.error(`Error updating configuration at ${path}:`, error);
      return false;
    }
  }

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
        .filter(path => {
            const value = this.getValue(path);
            return value === null || typeof value === 'undefined' || value === '';
        })
        .map(path => `${requiredSecrets[path]} (expected from secret)`);

    // Check required vars
    const missingVars = Object.keys(requiredVars)
        .filter(path => {
            const value = this.getValue(path);
            return value === null || typeof value === 'undefined' || value === '';
        })
        .map(path => `${requiredVars[path]} (expected from var in wrangler.toml)`);

    // Check numeric vars
    const invalidNumericVars = [];
    Object.keys(numericVars).forEach(path => {
        const value = this.getValue(path);
        if (typeof value !== 'number' || isNaN(value)) {
            invalidNumericVars.push(`${numericVars[path]} (must be a valid number in wrangler.toml)`);
        }
    });

    // Combine all validation failures
    const allMissing = [...missingSecrets, ...missingVars, ...invalidNumericVars];

    if (allMissing.length > 0) {
      const errorMsg = `Missing or invalid critical configuration parameters: ${allMissing.join(', ')}. Check wrangler.toml vars and Cloudflare secrets.`;
      console.error(errorMsg);
      // Depending on the application's needs, you might want to throw an error here
      // to prevent the worker from starting in a misconfigured state.
      throw new Error(errorMsg);
    }
    console.log('Configuration validated successfully.');
  }
}

/**
 * Initialize and load configuration
 * @param {KVNamespace} kvBinding - The KV Namespace binding passed from the environment
 * @param {Env} env - The environment object containing secrets and vars
 * @returns {Promise<Configuration>} - The loaded configuration instance
 */
export async function initializeConfig(kvBinding, env) {
  // Pass the actual binding to the constructor
  const config = new Configuration(kvBinding);
  // Pass the env object to the load method
  await config.load(env);
  return config; // Return the instance, not just the config object
}
