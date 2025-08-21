// Unit tests for LLM health check system
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  LLMHealthCheck, 
  createHealthCheck, 
  quickHealthCheck,
  getHealthStatusEmbed,
} from '../../src/llm/health-check.js'
import { createMockConfig } from '../setup.js'

// Mock the LLM API modules
vi.mock('../../src/llm/anthropic.js', () => ({
  callAnthropicAPI: vi.fn(),
}))

vi.mock('../../src/llm/openai.js', () => ({
  callOpenAIAPI: vi.fn(),
}))

vi.mock('../../src/llm/openrouter.js', () => ({
  callOpenRouterAPI: vi.fn(),
}))

import { callAnthropicAPI } from '../../src/llm/anthropic.js'
import { callOpenAIAPI } from '../../src/llm/openai.js'
import { callOpenRouterAPI } from '../../src/llm/openrouter.js'

describe('LLM Health Check System', () => {
  let config
  let healthCheck

  beforeEach(() => {
    vi.clearAllMocks()
    config = createMockConfig()
    healthCheck = new LLMHealthCheck(config.get())
  })

  describe('LLMHealthCheck class', () => {
    it('should initialize with configuration', () => {
      expect(healthCheck.config).toBeDefined()
      expect(healthCheck.logger).toBeDefined()
      expect(healthCheck.healthCache).toBeDefined()
    })

    it('should check provider configuration correctly', () => {
      // Test anthropic configuration
      expect(healthCheck.isProviderConfigured('anthropic')).toBe(true)
      
      // Test with invalid provider
      expect(healthCheck.isProviderConfigured('invalid')).toBe(false)
      
      // Test with missing API key
      const configWithoutKey = {
        ...config.get(),
        llm: { ...config.get().llm, apiKey: '' },
      }
      const healthCheckNoKey = new LLMHealthCheck(configWithoutKey)
      expect(healthCheckNoKey.isProviderConfigured('anthropic')).toBe(false)
    })

    it('should perform health check for anthropic', async () => {
      callAnthropicAPI.mockResolvedValueOnce('{"test": "response"}')
      
      const result = await healthCheck.performHealthCheck('anthropic')
      
      expect(result).toBe(true)
      expect(callAnthropicAPI).toHaveBeenCalledWith(
        'Health check',
        'OK',
        expect.objectContaining({
          llm: expect.objectContaining({
            maxTokens: 10,
            temperature: 0,
          }),
        }),
      )
    })

    it('should perform health check for openai', async () => {
      callOpenAIAPI.mockResolvedValueOnce('{"test": "response"}')
      
      const result = await healthCheck.performHealthCheck('openai')
      
      expect(result).toBe(true)
      expect(callOpenAIAPI).toHaveBeenCalled()
    })

    it('should perform health check for openrouter', async () => {
      callOpenRouterAPI.mockResolvedValueOnce('{"test": "response"}')
      
      const result = await healthCheck.performHealthCheck('openrouter')
      
      expect(result).toBe(true)
      expect(callOpenRouterAPI).toHaveBeenCalled()
    })

    it('should handle health check failures', async () => {
      callAnthropicAPI.mockRejectedValueOnce(new Error('API Error'))
      
      const result = await healthCheck.performHealthCheck('anthropic')
      
      expect(result).toBe(false)
    })

    it('should handle invalid responses', async () => {
      callAnthropicAPI.mockResolvedValueOnce('')
      
      const result = await healthCheck.performHealthCheck('anthropic')
      
      expect(result).toBe(false)
    })

    it('should timeout health checks', async () => {
      callAnthropicAPI.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      )
      
      const result = await healthCheck.performHealthCheck('anthropic')
      
      expect(result).toBe(false)
    }, 10000)

    it('should check individual provider with caching', async () => {
      callAnthropicAPI.mockResolvedValue('{"test": "response"}')
      
      const result1 = await healthCheck.checkProvider('anthropic')
      const result2 = await healthCheck.checkProvider('anthropic')
      
      expect(result1.healthy).toBe(true)
      expect(result1.provider).toBe('anthropic')
      expect(result1.responseTime).toBeDefined()
      expect(result1.lastChecked).toBeDefined()
      
      // Second call should use cache
      expect(callAnthropicAPI).toHaveBeenCalledTimes(1)
      expect(result2).toEqual(result1)
    })

    it('should check all providers', async () => {
      callAnthropicAPI.mockResolvedValue('{"test": "response"}')
      callOpenAIAPI.mockResolvedValue('{"test": "response"}')
      callOpenRouterAPI.mockResolvedValue('{"test": "response"}')
      
      const results = await healthCheck.checkAllProviders()
      
      expect(results.overall.healthy).toBe(true)
      expect(results.overall.healthyProviders).toBeGreaterThan(0)
      expect(results.overall.totalProviders).toBeGreaterThan(0)
      expect(results.providers.anthropic).toBeDefined()
    })

    it('should get best provider', async () => {
      callAnthropicAPI.mockResolvedValue('{"test": "response"}')
      
      // Mock response times
      healthCheck.checkProvider = vi.fn()
        .mockResolvedValueOnce({ healthy: true, provider: 'anthropic', responseTime: 100 })
        .mockResolvedValueOnce({ healthy: true, provider: 'openai', responseTime: 200 })
        .mockResolvedValueOnce({ healthy: false, provider: 'openrouter', responseTime: null })
      
      healthCheck.checkAllProviders = vi.fn().mockResolvedValueOnce({
        overall: { healthy: true },
        providers: {
          anthropic: { healthy: true, provider: 'anthropic', responseTime: 100 },
          openai: { healthy: true, provider: 'openai', responseTime: 200 },
          openrouter: { healthy: false, provider: 'openrouter', responseTime: null },
        },
      })
      
      const bestProvider = await healthCheck.getBestProvider()
      
      expect(bestProvider).toBe('anthropic') // Fastest response time
    })

    it('should return null when no providers are healthy', async () => {
      healthCheck.checkAllProviders = vi.fn().mockResolvedValueOnce({
        overall: { healthy: false },
        providers: {
          anthropic: { healthy: false },
          openai: { healthy: false },
          openrouter: { healthy: false },
        },
      })
      
      const bestProvider = await healthCheck.getBestProvider()
      
      expect(bestProvider).toBeNull()
    })

    it('should clear cache', () => {
      healthCheck.healthCache.set('test', 'value')
      healthCheck.clearCache()
      
      expect(healthCheck.healthCache.size).toBe(0)
    })
  })

  describe('Factory functions', () => {
    it('should create health check instance', () => {
      const instance = createHealthCheck(config.get())
      
      expect(instance).toBeInstanceOf(LLMHealthCheck)
      expect(instance.config).toEqual(config.get())
    })

    it('should perform quick health check', async () => {
      callAnthropicAPI.mockResolvedValue('{"test": "response"}')
      
      const results = await quickHealthCheck(config.get())
      
      expect(results.overall).toBeDefined()
      expect(results.providers).toBeDefined()
    })

    it('should generate health status embed', async () => {
      callAnthropicAPI.mockResolvedValue('{"test": "response"}')
      
      const embed = await getHealthStatusEmbed(config.get())
      
      expect(embed.title).toContain('Health Status')
      expect(embed.color).toBeDefined()
      expect(embed.fields).toBeDefined()
      expect(embed.timestamp).toBeDefined()
      expect(embed.footer).toBeDefined()
      
      // Should have overall status field
      const overallField = embed.fields.find(field => field.name.includes('Overall Status'))
      expect(overallField).toBeDefined()
      
      // Should have provider-specific fields
      const anthropicField = embed.fields.find(field => field.name.includes('Anthropic'))
      expect(anthropicField).toBeDefined()
    })

    it('should show unhealthy status in embed when no providers available', async () => {
      callAnthropicAPI.mockRejectedValue(new Error('API Error'))
      callOpenAIAPI.mockRejectedValue(new Error('API Error'))
      callOpenRouterAPI.mockRejectedValue(new Error('API Error'))
      
      const embed = await getHealthStatusEmbed(config.get())
      
      expect(embed.color).toBe(0xff0000) // Red for unhealthy
      const overallField = embed.fields.find(field => field.name.includes('Overall Status'))
      expect(overallField.value).toContain('Unhealthy')
    })
  })

  describe('Error handling', () => {
    it('should handle unknown provider gracefully', async () => {
      await expect(healthCheck.performHealthCheck('unknown')).rejects.toThrow('Unknown provider')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'TypeError'
      callAnthropicAPI.mockRejectedValueOnce(networkError)
      
      const result = await healthCheck.performHealthCheck('anthropic')
      
      expect(result).toBe(false)
    })

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API rate limited')
      callAnthropicAPI.mockRejectedValueOnce(apiError)
      
      const result = await healthCheck.checkProvider('anthropic')
      
      expect(result.healthy).toBe(false)
      expect(result.error).toBe('API rate limited')
    })
  })

  describe('Configuration validation', () => {
    it('should validate provider configuration requirements', () => {
      const validConfigs = [
        { llm: { service: 'anthropic', apiKey: 'test', anthropicEndpoint: 'https://api.anthropic.com' } },
        { llm: { service: 'openai', apiKey: 'test', openaiEndpoint: 'https://api.openai.com' } },
        { llm: { service: 'openrouter', apiKey: 'test', openrouterEndpoint: 'https://openrouter.ai' } },
      ]
      
      validConfigs.forEach(config => {
        const hc = new LLMHealthCheck(config)
        expect(hc.isProviderConfigured(config.llm.service)).toBe(true)
      })
    })

    it('should reject invalid configurations', () => {
      const invalidConfigs = [
        { llm: { service: 'anthropic', apiKey: '', anthropicEndpoint: 'https://api.anthropic.com' } },
        { llm: { service: 'anthropic', apiKey: 'test', anthropicEndpoint: '' } },
        { llm: { service: 'invalid', apiKey: 'test' } },
      ]
      
      invalidConfigs.forEach(config => {
        const hc = new LLMHealthCheck(config)
        expect(hc.isProviderConfigured(config.llm.service)).toBe(false)
      })
    })
  })
})