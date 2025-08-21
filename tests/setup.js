// Test setup and global mocks for Discord Status Bot
import { vi } from 'vitest'

// Mock crypto for testing environment
global.crypto = {
  randomUUID: () => 'test-uuid-123',
  subtle: {
    importKey: vi.fn(),
    verify: vi.fn().mockResolvedValue(true),
  },
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  },
}

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    return new Uint8Array(Buffer.from(str, 'utf8'))
  }
}

global.TextDecoder = class TextDecoder {
  decode(bytes) {
    return Buffer.from(bytes).toString('utf8')
  }
}

// Mock console for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}

// Mock fetch for external API calls
global.fetch = vi.fn()

// Common test data
export const TEST_DATA = {
  DISCORD_USER_ID: '123456789012345678',
  DISCORD_CHANNEL_ID: '987654321098765432',
  DISCORD_APPLICATION_ID: '111222333444555666',
  DISCORD_BOT_TOKEN: 'test.bot.token',
  DISCORD_PUBLIC_KEY: 'test_public_key_32_bytes_exactly',
  LLM_CREDENTIALS: 'anthropic:test-api-key',
  
  SAMPLE_STATUS_TEXT: 'Working on the Discord bot, feeling productive and energized!',
  
  SAMPLE_LLM_RESPONSE: {
    overall_status: 'Productive Development Session',
    mood_emoji: '💻',
    visual_theme: 'work',
    accent_color: '#4CAF50',
    metrics: [
      {
        name: 'Energy',
        value: 'High',
        value_rating: 4,
        trend: 'improved',
        icon: '⚡',
      },
      {
        name: 'Focus',
        value: 'Strong',
        value_rating: 4,
        trend: 'stable',
        icon: '🎯',
      },
    ],
    highlights: [
      {
        type: 'activity',
        description: 'Working on Discord bot development',
        timeframe: 'current',
        is_new: true,
      },
    ],
    persistent_context: [],
    personal_states: [
      {
        name: 'energy',
        emoji: '⚡',
        level: 4,
        time_since_last: 'now',
        trend: 'increasing',
      },
    ],
    narrative_summary: 'Currently in a productive development session working on the Discord bot with high energy and strong focus.',
    errors: [],
  },
  
  SAMPLE_USER_PROFILE: {
    theme: 'default',
    timezone: 'America/New_York',
    visibility: 'public',
    custom_emojis: {
      energy: '⚡',
      focus: '🎯',
    },
  },
  
  SAMPLE_DISCORD_INTERACTION: {
    type: 2, // APPLICATION_COMMAND
    id: 'interaction_id',
    application_id: '111222333444555666',
    token: 'interaction_token',
    version: 1,
    data: {
      name: 'status',
      options: [
        {
          name: 'update',
          type: 1,
          options: [
            {
              name: 'text',
              type: 3,
              value: 'Working on the Discord bot, feeling productive and energized!',
            },
          ],
        },
      ],
    },
    member: {
      user: {
        id: '123456789012345678',
        username: 'testuser',
      },
    },
    channel_id: '987654321098765432',
    guild_id: '555666777888999000',
  },
}

// Mock KV namespace
export function createMockKV() {
  const storage = new Map()
  
  return {
    get: vi.fn(async (key, options) => {
      const value = storage.get(key)
      if (!value) return null
      
      if (options?.type === 'json') {
        return JSON.parse(value)
      }
      return value
    }),
    
    put: vi.fn(async (key, value, options) => {
      if (typeof value === 'object') {
        storage.set(key, JSON.stringify(value))
      } else {
        storage.set(key, value)
      }
    }),
    
    delete: vi.fn(async (key) => {
      storage.delete(key)
    }),
    
    list: vi.fn(async (options = {}) => {
      const keys = Array.from(storage.keys())
      let filteredKeys = keys
      
      if (options.prefix) {
        filteredKeys = keys.filter(key => key.startsWith(options.prefix))
      }
      
      const limit = options.limit || 1000
      const resultKeys = filteredKeys.slice(0, limit).map(name => ({ name }))
      
      return {
        keys: resultKeys,
        list_complete: filteredKeys.length <= limit,
        cursor: null,
      }
    }),
    
    // Helper methods for testing
    _storage: storage,
    _clear: () => storage.clear(),
  }
}

// Mock configuration instance
export function createMockConfig(overrides = {}) {
  const defaultConfig = {
    discord: {
      apiEndpoint: 'https://discord.com/api/v10',
      applicationId: TEST_DATA.DISCORD_APPLICATION_ID,
      publicKey: TEST_DATA.DISCORD_PUBLIC_KEY,
      botToken: TEST_DATA.DISCORD_BOT_TOKEN,
      statusChannelId: TEST_DATA.DISCORD_CHANNEL_ID,
    },
    llm: {
      service: 'anthropic',
      model: 'claude-3-haiku-20240307',
      apiKey: 'test-api-key',
      maxTokens: 1000,
      temperature: 0.1,
      anthropicEndpoint: 'https://api.anthropic.com/v1/messages',
      openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
      openrouterEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
      relevanceThreshold: 0.3,
    },
    storage: {
      historyLimit: 3,
    },
    environment: 'test',
  }
  
  const config = { ...defaultConfig, ...overrides }
  const mockKV = createMockKV()
  
  return {
    get: vi.fn(() => config),
    getValue: vi.fn((path, defaultValue) => {
      const keys = path.split('.')
      let value = config
      for (const key of keys) {
        value = value?.[key]
        if (value === undefined) return defaultValue
      }
      return value
    }),
    setValue: vi.fn(async (path, value) => {
      const keys = path.split('.')
      let current = config
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return true
    }),
    getKvBinding: vi.fn(() => mockKV),
    getVersion: vi.fn(() => '2025.01.21'),
    getBuildId: vi.fn(() => 'test-build'),
    load: vi.fn(async () => config),
    validate: vi.fn(),
  }
}