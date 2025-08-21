// Unit tests for LLM processor
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  processStatus,
  selectLLMProvider,
  formatPrompt,
  parseResponse,
  validateResponse,
} from '../../src/llm/processor.js'
import { createMockConfig, TEST_DATA } from '../setup.js'

// Mock the LLM providers
vi.mock('../../src/llm/anthropic.js', () => ({
  callAnthropicAPI: vi.fn(),
}))

vi.mock('../../src/llm/openai.js', () => ({
  callOpenAIAPI: vi.fn(),
}))

vi.mock('../../src/llm/openrouter.js', () => ({
  callOpenRouterAPI: vi.fn(),
}))

vi.mock('../../src/llm/health-check.js', () => ({
  createHealthCheck: vi.fn(() => ({
    getBestProvider: vi.fn().mockResolvedValue('anthropic'),
  })),
}))

import { callAnthropicAPI } from '../../src/llm/anthropic.js'
import { callOpenAIAPI } from '../../src/llm/openai.js'
import { callOpenRouterAPI } from '../../src/llm/openrouter.js'

describe('LLM Processor', () => {
  let mockConfig

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = createMockConfig()
  })

  describe('processStatus', () => {
    it('should process status with anthropic provider', async () => {
      callAnthropicAPI.mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const result = await processStatus(
        'Working on the Discord bot',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )

      expect(callAnthropicAPI).toHaveBeenCalledWith(
        expect.stringContaining('Working on the Discord bot'),
        expect.any(String),
        expect.objectContaining({
          llm: expect.objectContaining({
            service: 'anthropic',
          }),
        })
      )

      expect(result).toEqual(expect.objectContaining({
        overall_status: expect.any(String),
        metrics: expect.any(Array),
        highlights: expect.any(Array),
      }))
    })

    it('should fall back to other providers on failure', async () => {
      callAnthropicAPI.mockRejectedValueOnce(new Error('Anthropic Error'))
      callOpenAIAPI.mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const result = await processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )

      expect(callAnthropicAPI).toHaveBeenCalled()
      expect(callOpenAIAPI).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should handle all providers failing', async () => {
      callAnthropicAPI.mockRejectedValue(new Error('Anthropic Error'))
      callOpenAIAPI.mockRejectedValue(new Error('OpenAI Error'))
      callOpenRouterAPI.mockRejectedValue(new Error('OpenRouter Error'))

      await expect(processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )).rejects.toThrow('All LLM providers failed')
    })

    it('should include user context in processing', async () => {
      callAnthropicAPI.mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const userContext = {
        recent_activity: ['Previous status update'],
        preferences: { focus_areas: ['productivity', 'health'] },
      }

      await processStatus(
        'New status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get(),
        userContext
      )

      const promptCall = callAnthropicAPI.mock.calls[0][0]
      expect(promptCall).toContain('Previous status update')
      expect(promptCall).toContain('productivity')
      expect(promptCall).toContain('health')
    })

    it('should validate response format', async () => {
      const invalidResponse = '{"invalid": "response"}'
      callAnthropicAPI.mockResolvedValueOnce(invalidResponse)

      await expect(processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )).rejects.toThrow('Invalid LLM response format')
    })

    it('should handle non-JSON responses', async () => {
      callAnthropicAPI.mockResolvedValueOnce('Not JSON')

      await expect(processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )).rejects.toThrow()
    })
  })

  describe('selectLLMProvider', () => {
    it('should select configured primary provider', () => {
      const config = {
        llm: {
          service: 'openai',
          preferredOrder: ['openai', 'anthropic', 'openrouter'],
        },
      }

      const provider = selectLLMProvider(config)
      expect(provider).toBe('openai')
    })

    it('should fall back to first available provider', () => {
      const config = {
        llm: {
          service: 'invalid',
          preferredOrder: ['anthropic', 'openai'],
        },
      }

      const provider = selectLLMProvider(config)
      expect(provider).toBe('anthropic')
    })

    it('should handle empty configuration', () => {
      const config = { llm: {} }

      const provider = selectLLMProvider(config)
      expect(['anthropic', 'openai', 'openrouter']).toContain(provider)
    })

    it('should respect provider availability', () => {
      const config = {
        llm: {
          service: 'anthropic',
          apiKey: '',
          anthropicEndpoint: '',
        },
      }

      const provider = selectLLMProvider(config)
      expect(provider).not.toBe('anthropic') // Should skip unconfigured provider
    })
  })

  describe('formatPrompt', () => {
    it('should format basic prompt with status', () => {
      const prompt = formatPrompt('Working on project', TEST_DATA.DISCORD_USER_ID)

      expect(prompt).toContain('Working on project')
      expect(prompt).toContain(TEST_DATA.DISCORD_USER_ID)
      expect(prompt).toContain('analyze this status update')
    })

    it('should include user context when provided', () => {
      const context = {
        recent_activity: ['Previous update'],
        preferences: { timezone: 'UTC' },
      }

      const prompt = formatPrompt('New status', TEST_DATA.DISCORD_USER_ID, context)

      expect(prompt).toContain('Previous update')
      expect(prompt).toContain('UTC')
    })

    it('should handle missing context gracefully', () => {
      const prompt = formatPrompt('Status text', TEST_DATA.DISCORD_USER_ID, null)

      expect(prompt).toContain('Status text')
      expect(prompt).not.toContain('undefined')
    })

    it('should include response format instructions', () => {
      const prompt = formatPrompt('Test', TEST_DATA.DISCORD_USER_ID)

      expect(prompt).toContain('JSON format')
      expect(prompt).toContain('overall_status')
      expect(prompt).toContain('metrics')
      expect(prompt).toContain('highlights')
    })

    it('should handle special characters in status', () => {
      const statusWithSpecialChars = 'Working on "project" & making 100% progress!'
      const prompt = formatPrompt(statusWithSpecialChars, TEST_DATA.DISCORD_USER_ID)

      expect(prompt).toContain(statusWithSpecialChars)
    })
  })

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE)
      const parsed = parseResponse(response)

      expect(parsed).toEqual(TEST_DATA.SAMPLE_LLM_RESPONSE)
    })

    it('should extract JSON from markdown blocks', () => {
      const response = '```json\n' + JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE) + '\n```'
      const parsed = parseResponse(response)

      expect(parsed).toEqual(TEST_DATA.SAMPLE_LLM_RESPONSE)
    })

    it('should handle responses with extra text', () => {
      const response = 'Here is the analysis:\n' + JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE) + '\nHope this helps!'
      const parsed = parseResponse(response)

      expect(parsed).toEqual(TEST_DATA.SAMPLE_LLM_RESPONSE)
    })

    it('should throw on invalid JSON', () => {
      expect(() => parseResponse('not json')).toThrow('Failed to parse LLM response')
      expect(() => parseResponse('{invalid: json}')).toThrow('Failed to parse LLM response')
    })

    it('should handle empty response', () => {
      expect(() => parseResponse('')).toThrow('Failed to parse LLM response')
      expect(() => parseResponse(null)).toThrow('Failed to parse LLM response')
    })

    it('should extract nested JSON objects', () => {
      const nestedResponse = `The analysis is: ${JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE)} and that's it.`
      const parsed = parseResponse(nestedResponse)

      expect(parsed).toEqual(TEST_DATA.SAMPLE_LLM_RESPONSE)
    })
  })

  describe('validateResponse', () => {
    it('should validate complete response structure', () => {
      expect(() => validateResponse(TEST_DATA.SAMPLE_LLM_RESPONSE)).not.toThrow()
    })

    it('should require overall_status field', () => {
      const response = { ...TEST_DATA.SAMPLE_LLM_RESPONSE }
      delete response.overall_status

      expect(() => validateResponse(response)).toThrow('Missing required field: overall_status')
    })

    it('should require metrics array', () => {
      const response = { ...TEST_DATA.SAMPLE_LLM_RESPONSE }
      delete response.metrics

      expect(() => validateResponse(response)).toThrow('Missing required field: metrics')
    })

    it('should validate metric structure', () => {
      const response = {
        ...TEST_DATA.SAMPLE_LLM_RESPONSE,
        metrics: [{ name: 'Energy' }], // Missing required fields
      }

      expect(() => validateResponse(response)).toThrow('Invalid metric structure')
    })

    it('should validate highlights structure', () => {
      const response = {
        ...TEST_DATA.SAMPLE_LLM_RESPONSE,
        highlights: [{ description: 'Test' }], // Missing type
      }

      expect(() => validateResponse(response)).toThrow('Invalid highlight structure')
    })

    it('should validate personal_state structure', () => {
      const response = {
        ...TEST_DATA.SAMPLE_LLM_RESPONSE,
        personal_state: [{ name: 'energy' }], // Missing required fields
      }

      expect(() => validateResponse(response)).toThrow('Invalid personal_state structure')
    })

    it('should allow optional fields to be missing', () => {
      const minimalResponse = {
        overall_status: 'Test Status',
        metrics: [],
        highlights: [],
      }

      expect(() => validateResponse(minimalResponse)).not.toThrow()
    })

    it('should validate data types', () => {
      const response = {
        ...TEST_DATA.SAMPLE_LLM_RESPONSE,
        overall_status: 123, // Should be string
      }

      expect(() => validateResponse(response)).toThrow('overall_status must be a string')
    })

    it('should validate array fields', () => {
      const response = {
        ...TEST_DATA.SAMPLE_LLM_RESPONSE,
        metrics: 'not an array',
      }

      expect(() => validateResponse(response)).toThrow('metrics must be an array')
    })
  })

  describe('Error handling and retries', () => {
    it('should retry on transient errors', async () => {
      callAnthropicAPI
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const result = await processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )

      expect(callAnthropicAPI).toHaveBeenCalledTimes(2)
      expect(result).toBeDefined()
    })

    it('should handle timeout errors', async () => {
      callAnthropicAPI.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      )

      const config = {
        ...mockConfig.get(),
        llm: {
          ...mockConfig.get().llm,
          timeout: 1000,
        },
      }

      await expect(processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        config
      )).rejects.toThrow()
    })

    it('should handle provider-specific errors', async () => {
      const anthropicError = new Error('Anthropic API Error')
      anthropicError.status = 429

      callAnthropicAPI.mockRejectedValueOnce(anthropicError)
      callOpenAIAPI.mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const result = await processStatus(
        'Test status',
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )

      expect(result).toBeDefined()
    })
  })

  describe('Performance and optimization', () => {
    it('should handle large status inputs efficiently', async () => {
      const largeStatus = 'x'.repeat(10000)
      callAnthropicAPI.mockResolvedValueOnce(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))

      const start = Date.now()
      await processStatus(
        largeStatus,
        TEST_DATA.DISCORD_USER_ID,
        mockConfig.get()
      )
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000) // Should complete quickly
    })

    it('should handle concurrent processing requests', async () => {
      callAnthropicAPI.mockImplementation(() => 
        Promise.resolve(JSON.stringify(TEST_DATA.SAMPLE_LLM_RESPONSE))
      )

      const promises = Array.from({ length: 5 }, (_, i) =>
        processStatus(
          `Status ${i}`,
          TEST_DATA.DISCORD_USER_ID,
          mockConfig.get()
        )
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      expect(results.every(result => result.overall_status)).toBe(true)
    })

    it('should cache prompt templates', () => {
      const prompt1 = formatPrompt('Status 1', TEST_DATA.DISCORD_USER_ID)
      const prompt2 = formatPrompt('Status 2', TEST_DATA.DISCORD_USER_ID)

      // Should reuse template structure
      expect(prompt1.split('\n').length).toBe(prompt2.split('\n').length)
    })
  })
})